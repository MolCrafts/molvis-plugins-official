/**
 * Host kernel — thin adapter over `@jupyterlite/pyodide-kernel`.
 *
 * UI keeps {@link RunResult}; execution is a real JupyterLite Pyodide worker
 * (IPython / streams / interrupt buffer when COOP+COEP). Molvis Stage RPC
 * crosses the worker boundary via postMessage (`molvis_rpc`).
 */

import type { KernelMessage } from "@jupyterlab/services";
// Deep import + rsbuild replacement of `_pypi.js` → stub (no binary .whl).
import { PyodideKernel } from "@jupyterlite/pyodide-kernel/lib/kernel.js";

import {
  MICROPIP_REQUIREMENTS,
  PYODIDE_INDEX_URL,
  PYODIDE_VERSION,
} from "../cdn";
import type { RpcClient } from "../rpc/client";
import { createRpcClient } from "../rpc/client";
import { rpcFailure, rpcSuccess } from "../rpc/envelope";
import { BOOTSTRAP_STAGES } from "./bootstrap";
import { isInterruptError } from "./errors";
import { MemoryContentsManager } from "./memory_contents";
import {
  PIPLITE_INDEX,
  PIPLITE_WHEEL,
  pluginAssetUrl,
  sameOriginWorkerUrl,
} from "./runtime_assets";
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

/** Same-origin worker URL, prefetched by `HostKernel.start` (initWorker is sync). */
let pendingWorkerUrl: string | null = null;

type KernelInternals = {
  _worker: Worker;
  _remoteKernel: {
    execute: (
      content: KernelMessage.IExecuteRequestMsg["content"],
      parent: unknown,
    ) => Promise<Record<string, unknown> | null | undefined>;
  };
  _parent?: KernelMessage.IMessage;
  _parentHeader?: KernelMessage.IHeader;
};

/**
 * MolVis runs the kernel on `@jupyterlite/pyodide-kernel`'s **coincident**
 * worker, which requires the host page to be cross-origin isolated.
 *
 * The alternative (comlink, used by upstream when COI is unavailable) cannot
 * execute cells at all here: `PyodideRemoteKernel.execute()` assigns
 * stream/display callbacks across the boundary and Comlink cannot
 * structured-clone a function — every cell dies with `DataCloneError` /
 * `Unserializable return value`. Serve MolVis with COOP + COEP; there is no
 * degraded mode to fall back to.
 */
const KERNEL_WORKER = "coincident.worker.js";

class MolvisPyodideKernel extends PyodideKernel {
  protected initWorker(_options: PyodideKernel.IOptions): Worker {
    const url = pendingWorkerUrl;
    pendingWorkerUrl = null;
    if (!url) {
      throw new Error(
        "Kernel worker URL not prepared — HostKernel.start must prefetch it",
      );
    }
    const worker = new Worker(url, { type: "module" });
    worker.addEventListener("message", (ev) => {
      void this._onWorkerRpc(ev);
    });
    return worker;
  }

  /** Only flat sibling URLs (not webpack `/static/assets/…`). */
  initRemoteOptions(options: PyodideKernel.IOptions) {
    const remote = super.initRemoteOptions(options);
    return {
      ...remote,
      pipliteWheelUrl: options.pipliteWheelUrl ?? remote.pipliteWheelUrl,
      pipliteUrls: options.pipliteUrls ? [...options.pipliteUrls] : [],
    };
  }

  async executeRequest(
    content: KernelMessage.IExecuteRequestMsg["content"],
  ): Promise<KernelMessage.IExecuteReplyMsg["content"]> {
    await this.ready;
    const self = this as unknown as KernelInternals;
    // Direct executeRequest (not handleMessage) leaves parent unset.
    if (!self._parent) {
      const parent = syntheticExecuteParent(this.id, content);
      self._parent = parent;
      self._parentHeader = parent.header;
    }
    const exec = self._remoteKernel?.execute;
    if (typeof exec !== "function") {
      throw new Error(
        "Kernel remote.execute is missing — the worker never bound its RPC.",
      );
    }
    const result = await exec.call(self._remoteKernel, content, self._parent);
    if (result == null || typeof result !== "object") {
      throw new Error(
        `Kernel worker returned no execute result (${String(result)}). ` +
          "Worker RPC failed — open DevTools → Worker console for details.",
      );
    }
    result.execution_count = this.executionCount;
    // Worker RPC is untyped at the wire; the shape is validated above.
    return result as unknown as KernelMessage.IExecuteReplyMsg["content"];
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
    // Must not collide with Comlink frames (numeric `type` / path arrays).
    if ((data as { type?: string }).type !== "molvis_rpc") return;
    const { id, method, params } = data as {
      id: string;
      method: string;
      params?: Record<string, unknown>;
    };
    const worker = (this as unknown as KernelInternals)._worker;
    if (!worker) return;
    try {
      if (!this._rpcHandler) {
        throw new Error("molvis RPC handler not bound (app not ready)");
      }
      const payload = await this._rpcHandler(method, params ?? {});
      worker.postMessage(rpcSuccess(id, payload));
    } catch (err) {
      worker.postMessage(rpcFailure(id, err));
    }
  }
}

function syntheticExecuteParent(
  session: string,
  content: KernelMessage.IExecuteRequestMsg["content"],
): KernelMessage.IExecuteRequestMsg {
  const header = {
    msg_id: crypto.randomUUID(),
    session,
    username: "molvis",
    date: new Date().toISOString(),
    msg_type: "execute_request" as const,
    version: "5.3",
  };
  return {
    header,
    parent_header: {},
    metadata: {},
    content,
    channel: "shell",
    buffers: [],
  } as KernelMessage.IExecuteRequestMsg;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${Math.round(ms / 1000)}s. ` +
            "Check network (Pyodide CDN) and DevTools → Worker console.",
        ),
      );
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
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
    if (!globalThis.crossOriginIsolated) {
      // Fail here rather than a few seconds later on every cell: see the
      // comment on KERNEL_WORKER.
      const message =
        "Python needs a cross-origin isolated page. Serve MolVis with " +
        "Cross-Origin-Opener-Policy: same-origin and " +
        "Cross-Origin-Embedder-Policy: require-corp.";
      this.lastError = message;
      this.setStatus("error");
      this.pushLog({ source: "system", stream: "stderr", text: message });
      throw new Error(message);
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

      const pipliteWheel = pluginAssetUrl(PIPLITE_WHEEL);
      const pipliteIndex = pluginAssetUrl(PIPLITE_INDEX);
      const workerRemote = pluginAssetUrl(KERNEL_WORKER);

      this.pushLog({
        source: "system",
        stream: "info",
        text: `Fetching worker ${workerRemote}…`,
      });
      pendingWorkerUrl = await sameOriginWorkerUrl(workerRemote);

      this.pushLog({
        source: "system",
        stream: "info",
        text: `Loading Pyodide ${PYODIDE_VERSION} (first run downloads ~few MB)…`,
      });

      const kernel = new MolvisPyodideKernel({
        id: `molvis-${Math.random().toString(36).slice(2, 10)}`,
        name: "python",
        location: "",
        sendMessage,
        pyodideUrl: PYODIDE_JS,
        pipliteWheelUrl: pipliteWheel,
        pipliteUrls: [pipliteIndex],
        disablePyPIFallback: false,
        mountDrive: false,
        loadPyodideOptions: {
          lockFileURL: PYODIDE_LOCK,
          // Keep first paint light — numpy comes via micropip later if needed.
          packages: ["micropip"],
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
      await withTimeout(kernel.ready, 180_000, "Pyodide worker initialize");

      this.pushLog({
        source: "system",
        stream: "info",
        text: `micropip install ${MICROPIP_REQUIREMENTS.join(", ")}…`,
      });
      await withTimeout(
        this.executeSilent(
          `
import micropip
await micropip.install(${JSON.stringify([...MICROPIP_REQUIREMENTS])}, keep_going=True)
`,
          "system",
        ),
        180_000,
        "micropip install ecosystem",
      );

      this.pushLog({
        source: "system",
        stream: "info",
        text: "Running molvis bootstrap…",
      });
      // One execution per stage: a traceback then names the stage that broke.
      for (const stage of BOOTSTRAP_STAGES) {
        const reply = await this.executeSilent(stage.source, "system");
        if (reply.status === "error") {
          throw new Error(
            `bootstrap stage '${stage.label}' failed: ` +
              `${reply.ename ?? "Error"}: ${reply.evalue ?? ""}`,
          );
        }
      }
      this.bootstrapped = true;

      if (Object.keys(this.scripts).length) {
        await this.syncScripts(this.scripts);
      }

      this.setStatus("ready");
      this.pushLog({
        source: "system",
        stream: "info",
        text: "Pyodide kernel ready.",
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
