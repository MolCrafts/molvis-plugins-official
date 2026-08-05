/**
 * Host kernel — thin adapter over `@jupyterlite/pyodide-kernel`.
 *
 * UI keeps {@link RunResult}; execution is a real JupyterLite Pyodide worker
 * (IPython / streams / interrupt buffer when COOP+COEP). Molvis Stage RPC
 * crosses the worker boundary via postMessage (`molvis_rpc`).
 */

import type { KernelMessage } from "@jupyterlab/services";
// Deep import avoids `_pypi.js` re-exporting binary .whl as JS modules
// (rspack cannot parse wheel zip bytes).
import { PyodideKernel } from "@jupyterlite/pyodide-kernel/lib/kernel.js";

import { MICROPIP_REQUIREMENTS, PYODIDE_INDEX_URL } from "../cdn";
import type { RpcClient } from "../rpc/client";
import { createRpcClient } from "../rpc/client";
import { BOOTSTRAP_PY } from "./bootstrap";
import { LOCAL_PY_ROOT, LOCAL_PY_SOURCES } from "./local_py_sources";
import { MemoryContentsManager } from "./memory_contents";
import { isInterruptError } from "./errors";
import type {
  KernelListener,
  KernelLogLine,
  KernelStatus,
  MimeBundle,
  RunResult,
  RunSource,
} from "./types";

export { isInterruptError } from "./errors";

const PYODIDE_JS = `${PYODIDE_INDEX_URL}pyodide.mjs`;
const PYODIDE_LOCK = `${PYODIDE_INDEX_URL}pyodide-lock.json`;

/** Assets co-located with plugin.js after `npm run copy:workers`. */
function assetUrl(rel: string): string {
  return new URL(rel, import.meta.url).href;
}

function workerUrl(name: "comlink.worker.js" | "coincident.worker.js"): URL {
  return new URL(`./${name}`, import.meta.url);
}

/** Subclass so worker URLs resolve next to our plugin bundle. */
class MolvisPyodideKernel extends PyodideKernel {
  protected initWorker(_options: PyodideKernel.IOptions): Worker {
    const name =
      typeof crossOriginIsolated !== "undefined" && crossOriginIsolated
        ? "coincident.worker.js"
        : "comlink.worker.js";
    const url = workerUrl(name);
    const worker = new Worker(url, { type: "module" });
    // Molvis Stage RPC: worker Python posts {type:"molvis_rpc"} → host.
    worker.addEventListener("message", (ev) => {
      void this._onWorkerRpc(ev);
    });
    return worker;
  }

  private _rpcHandler:
    | ((method: string, params: Record<string, unknown>) => Promise<unknown>)
    | null = null;

  setRpcHandler(
    handler: (
      method: string,
      params: Record<string, unknown>,
    ) => Promise<unknown>,
  ): void {
    this._rpcHandler = handler;
  }

  private async _onWorkerRpc(ev: MessageEvent): Promise<void> {
    const data = ev.data;
    if (!data || typeof data !== "object") return;
    if ((data as { type?: string }).type !== "molvis_rpc") return;
    const { id, method, params } = data as {
      id: string;
      method: string;
      params?: Record<string, unknown>;
    };
    const worker = (this as unknown as { _worker?: Worker })._worker;
    if (!worker) return;
    try {
      if (!this._rpcHandler) {
        throw new Error("molvis RPC handler not bound (app not ready)");
      }
      const payload = await this._rpcHandler(method, params ?? {});
      worker.postMessage({
        type: "molvis_rpc_reply",
        id,
        ok: true,
        payload,
      });
    } catch (err) {
      worker.postMessage({
        type: "molvis_rpc_reply",
        id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function asMimeBundle(data: unknown): MimeBundle | undefined {
  if (!data || typeof data !== "object") return undefined;
  const out: MimeBundle = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
    else if (v != null) out[k] = JSON.stringify(v);
  }
  return Object.keys(out).length ? out : undefined;
}

export class HostKernel {
  private status: KernelStatus = "idle";
  private listeners = new Set<KernelListener>();
  private logs: KernelLogLine[] = [];
  private logSeq = 0;
  private runLock = false;
  private lastError: string | null = null;
  private scripts: Record<string, string> = {};
  private rpc: RpcClient | null = null;
  /** @internal visible for singleton reset */
  kernel: MolvisPyodideKernel | null = null;
  private contents: MemoryContentsManager | null = null;
  private bootstrapped = false;

  /** Collect IOPub for the active execute. */
  private active: {
    stdout: string;
    stderr: string;
    displays: MimeBundle[];
    data?: MimeBundle;
  } | null = null;

  setApp(app: unknown | null): void {
    this.rpc = app ? createRpcClient(app) : null;
    if (this.kernel) {
      this.kernel.setRpcHandler((method, params) => {
        if (!this.rpc) {
          return Promise.reject(new Error("molvis RPC client not bound"));
        }
        return this.rpc.call(method, params);
      });
    }
  }

  /** @deprecated use setApp */
  setBridge(bridge: { call: RpcClient["call"]; app?: unknown } | null): void {
    if (!bridge) {
      this.rpc = null;
      return;
    }
    if ("app" in bridge && bridge.app) {
      this.setApp(bridge.app);
      return;
    }
    this.rpc = {
      app: null,
      call: (method, params) =>
        Promise.resolve(bridge.call(method, params ?? {})),
    };
  }

  getStatus(): KernelStatus {
    return this.status;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getLogs(): KernelLogLine[] {
    return this.logs;
  }

  getScripts(): Record<string, string> {
    return { ...this.scripts };
  }

  subscribe(listener: KernelListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        /* ignore */
      }
    }
  }

  private setStatus(status: KernelStatus): void {
    this.status = status;
    this.emit();
  }

  private pushLog(partial: Omit<KernelLogLine, "id" | "at">): void {
    this.logs = [
      ...this.logs,
      {
        ...partial,
        id: `log-${++this.logSeq}`,
        at: Date.now(),
      },
    ].slice(-2000);
    this.emit();
  }

  clearLogs(): void {
    this.logs = [];
    this.emit();
  }

  async syncScripts(map: Record<string, string>): Promise<void> {
    this.scripts = { ...map };
    if (!this.kernel || !this.bootstrapped) return;
    const payload = JSON.stringify(this.scripts);
    await this.executeSilent(
      `_MOLVIS_SCRIPTS = __import__("json").loads(${JSON.stringify(payload)})\n`,
      "system",
    );
  }

  async start(): Promise<void> {
    if (this.kernel) {
      await this.kernel.ready;
      return;
    }
    if (this.status === "loading") {
      await this.waitUntilReady();
      return;
    }
    this.setStatus("loading");
    this.lastError = null;
    this.pushLog({
      source: "system",
      stream: "info",
      text: "Starting JupyterLite pyodide-kernel…",
    });

    try {
      this.contents = new MemoryContentsManager();

      const sendMessage = (msg: KernelMessage.IMessage): void => {
        this.onKernelMessage(msg);
      };

      const kernel = new MolvisPyodideKernel({
        id: `molvis-${Math.random().toString(36).slice(2, 10)}`,
        name: "python",
        location: "",
        sendMessage,
        pyodideUrl: PYODIDE_JS,
        pipliteWheelUrl: assetUrl("./pypi/piplite-0.8.2-py3-none-any.whl"),
        pipliteUrls: [assetUrl("./pypi/all.json")],
        disablePyPIFallback: false,
        mountDrive: false,
        loadPyodideOptions: {
          lockFileURL: PYODIDE_LOCK,
          packages: ["micropip", "numpy"],
        },
        contentsManager: this.contents,
      } as unknown as PyodideKernel.IOptions);

      if (this.rpc) {
        kernel.setRpcHandler((method, params) => {
          if (!this.rpc) {
            return Promise.reject(new Error("molvis RPC client not bound"));
          }
          return this.rpc.call(method, params);
        });
      }

      this.kernel = kernel;
      await kernel.ready;

      this.pushLog({
        source: "system",
        stream: "info",
        text: "Kernel worker ready · installing packages + molvis…",
      });

      // Write monorepo pack into the worker FS under LOCAL_PY_ROOT.
      await this.executeSilent(
        `
import pathlib
pathlib.Path(${JSON.stringify(LOCAL_PY_ROOT)}).mkdir(parents=True, exist_ok=True)
`,
        "system",
      );

      const entries = Object.entries(LOCAL_PY_SOURCES);
      const BATCH = 15;
      for (let i = 0; i < entries.length; i += BATCH) {
        const slice = entries.slice(i, i + BATCH);
        const payload = Object.fromEntries(slice);
        await this.executeSilent(
          `
import pathlib, json
root = pathlib.Path(${JSON.stringify(LOCAL_PY_ROOT)})
files = json.loads(${JSON.stringify(JSON.stringify(payload))})
for rel, body in files.items():
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body)
`,
          "system",
        );
      }

      await this.executeSilent(
        `
import micropip
await micropip.install(${JSON.stringify([...MICROPIP_REQUIREMENTS])}, keep_going=True)
`,
        "system",
      );

      await this.executeSilent(BOOTSTRAP_PY, "system");
      this.bootstrapped = true;

      if (Object.keys(this.scripts).length) {
        await this.syncScripts(this.scripts);
      }

      this.setStatus("ready");
      this.pushLog({
        source: "system",
        stream: "info",
        text: "Pyodide kernel ready (JupyterLite worker).",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.lastError = message;
      this.setStatus("error");
      this.pushLog({
        source: "system",
        stream: "stderr",
        text: `Kernel failed: ${message}`,
      });
      this.kernel?.dispose();
      this.kernel = null;
      throw err;
    }
  }

  private async waitUntilReady(): Promise<void> {
    const start = Date.now();
    while (this.status === "loading" && Date.now() - start < 180_000) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (this.status === "error") {
      throw new Error(this.lastError ?? "kernel error");
    }
  }

  private onKernelMessage(msg: KernelMessage.IMessage): void {
    if (msg.channel !== "iopub" || !this.active) return;
    const type = msg.header.msg_type;
    const content = msg.content as Record<string, unknown>;

    if (type === "stream") {
      const name = String(content.name ?? "stdout");
      const text = String(content.text ?? "");
      if (name === "stderr") this.active.stderr += text;
      else this.active.stdout += text;
      this.pushLog({
        source: "cell",
        stream: name === "stderr" ? "stderr" : "stdout",
        text,
      });
      return;
    }
    if (type === "execute_result") {
      const data = asMimeBundle(content.data);
      if (data) this.active.data = data;
      return;
    }
    if (type === "display_data") {
      const data = asMimeBundle(content.data);
      if (data) this.active.displays.push(data);
      return;
    }
    if (type === "error") {
      const ename = String(content.ename ?? "Error");
      const evalue = String(content.evalue ?? "");
      const tb = Array.isArray(content.traceback)
        ? (content.traceback as string[]).join("\n")
        : "";
      this.active.stderr += tb || `${ename}: ${evalue}\n`;
    }
  }

  private async executeSilent(
    code: string,
    source: RunSource,
  ): Promise<KernelMessage.IExecuteReplyMsg["content"]> {
    if (!this.kernel) throw new Error("kernel not started");
    this.active = { stdout: "", stderr: "", displays: [] };
    try {
      const reply = await this.kernel.executeRequest({
        code,
        silent: true,
        store_history: false,
        user_expressions: {},
        allow_stdin: false,
        stop_on_error: true,
      });
      if (this.active.stdout) {
        this.pushLog({ source, stream: "stdout", text: this.active.stdout });
      }
      if (this.active.stderr) {
        this.pushLog({ source, stream: "stderr", text: this.active.stderr });
      }
      return reply;
    } finally {
      this.active = null;
    }
  }

  async run(
    code: string,
    source: RunSource,
    meta?: { cellId?: string },
  ): Promise<RunResult> {
    if (this.runLock) {
      const msg = "Kernel busy — wait for the current run to finish.";
      this.pushLog({
        source,
        stream: "stderr",
        text: msg,
        cellId: meta?.cellId,
      });
      return { ok: false, stdout: "", stderr: msg, error: msg };
    }

    await this.start();
    if (!this.kernel) {
      const msg = this.lastError ?? "Kernel not ready";
      return { ok: false, stdout: "", stderr: msg, error: msg };
    }

    this.runLock = true;
    this.setStatus("busy");
    this.active = { stdout: "", stderr: "", displays: [] };

    try {
      const reply = await this.kernel.executeRequest({
        code,
        silent: false,
        store_history: true,
        user_expressions: {},
        allow_stdin: false,
        stop_on_error: true,
      });

      const stdout = this.active.stdout;
      const stderr = this.active.stderr;
      const data = this.active.data;
      const displays = this.active.displays;

      if (reply.status === "error") {
        const ename = reply.ename ?? "Error";
        const evalue = reply.evalue ?? "";
        const message = `${ename}: ${evalue}`;
        const interrupted = isInterruptError(message) || isInterruptError(stderr);
        this.setStatus("ready");
        this.pushLog({
          source,
          stream: interrupted ? "info" : "stderr",
          text: interrupted ? "Execution stopped." : message,
          cellId: meta?.cellId,
        });
        return interrupted
          ? {
              ok: false,
              interrupted: true,
              stdout,
              stderr,
              error: "Execution stopped.",
            }
          : {
              ok: false,
              stdout,
              stderr: stderr || message,
              error: message,
              displays: displays.length ? displays : undefined,
            };
      }

      this.setStatus("ready");
      return {
        ok: true,
        stdout,
        stderr,
        data,
        displays: displays.length ? displays : undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const interrupted = isInterruptError(message);
      this.setStatus("ready");
      this.pushLog({
        source,
        stream: interrupted ? "info" : "stderr",
        text: interrupted ? "Execution stopped." : message,
        cellId: meta?.cellId,
      });
      return interrupted
        ? {
            ok: false,
            interrupted: true,
            stdout: this.active?.stdout ?? "",
            stderr: this.active?.stderr ?? "",
            error: "Execution stopped.",
          }
        : {
            ok: false,
            stdout: this.active?.stdout ?? "",
            stderr: (this.active?.stderr ?? "") + message,
            error: message,
          };
    } finally {
      this.active = null;
      this.runLock = false;
    }
  }

  async runNamedScript(name: string): Promise<RunResult> {
    const key = name.endsWith(".py") ? name : `${name}.py`;
    return this.run(
      `import molvis as mv\nmv.run(${JSON.stringify(key)})`,
      "script",
    );
  }

  interrupt(): void {
    const busy = this.runLock;
    this.pushLog({
      source: "system",
      stream: "info",
      text: busy ? "Stopping current cell…" : "No running cell.",
    });
    // JupyterLite KernelClient interrupt cancels the execute mutex; when
    // crossOriginIsolated, the worker also has a real interrupt buffer.
    // Dispose+restart is the reliable fallback without the full client.
    try {
      const k = this.kernel as unknown as {
        _remoteKernel?: { interrupt?: () => Promise<void> };
      };
      void k._remoteKernel?.interrupt?.();
    } catch {
      /* ignore */
    }
  }

  async reset(): Promise<void> {
    try {
      this.interrupt();
    } catch {
      /* ignore */
    }
    this.kernel?.dispose();
    this.kernel = null;
    this.contents = null;
    this.bootstrapped = false;
    this.runLock = false;
    this.lastError = null;
    this.setStatus("idle");
    this.pushLog({ source: "system", stream: "info", text: "Kernel reset." });
    await this.start();
  }
}

let singleton: HostKernel | null = null;

export function getKernel(): HostKernel {
  if (!singleton) singleton = new HostKernel();
  return singleton;
}

export function _resetKernelSingleton(): void {
  if (singleton) {
    singleton.kernel?.dispose();
  }
  singleton = null;
}
