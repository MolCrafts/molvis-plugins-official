/**
 * Shared Pyodide kernel for notebook cells + script dialog.
 *
 * Injects ``molvis`` with InProcess bridge so::
 *
 *     import molvis as mv
 *     mv.run("camera.py")
 *     stage.camera.set_pose(alpha=1.2)
 *
 * talks to the live Molvis app (not a print stub).
 */

import type { HostBridge } from "../bridge/host_bridge";
import type {
  KernelListener,
  KernelLogLine,
  KernelStatus,
  RunResult,
  RunSource,
} from "./types";

// Pyodide 314.x ships CPython 3.14 — matches molcrafts-molrs pyemscripten wheels.
const PYODIDE_INDEX = "https://cdn.jsdelivr.net/pyodide/v314.0.3/full/";

type PyodideLike = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
  loadPackage: (name: string | string[]) => Promise<void>;
  registerJsModule: (name: string, mod: Record<string, unknown>) => void;
};

async function loadPyodideFromCdn(): Promise<PyodideLike> {
  const url = `${PYODIDE_INDEX}pyodide.mjs`;
  const mod = await import(
    /* webpackIgnore: true */
    /* @vite-ignore */
    url
  );
  const loadPyodide = (
    mod as { loadPyodide: (opts: { indexURL: string }) => Promise<PyodideLike> }
  ).loadPyodide;
  return loadPyodide({ indexURL: PYODIDE_INDEX });
}

const BOOTSTRAP_PY = `
import sys
import types
import math
# Script library map: name -> source (synced from JS)
_MOLVIS_SCRIPTS = dict(globals().get("_MOLVIS_SCRIPTS") or {})

# Host bridge registered as JS module "molvis_host"
from molvis_host import call as _host_call

def _bridge(method, params=None):
    p = params or {}
    # pyodide: plain dict → JS object
    return _host_call(method, p)

class Camera:
    """Camera control — InProcess RPC to the live viewer."""
    def __init__(self, stage):
        self._stage = stage

    def get_pose(self):
        return _bridge("camera.get_pose", {})

    def set_pose(self, *, alpha=None, beta=None, radius=None, target=None):
        params = {}
        if alpha is not None:
            params["alpha"] = float(alpha)
        if beta is not None:
            params["beta"] = float(beta)
        if radius is not None:
            params["radius"] = float(radius)
        if target is not None:
            params["target"] = [float(v) for v in target]
        result = _bridge("camera.set_pose", params)
        return result.get("pose") if hasattr(result, "get") else getattr(result, "pose", result)

    def fit(self):
        """Alias for fit_view (molpy-style short name)."""
        return self.fit_view()

    def fit_view(self):
        result = _bridge("camera.fit_view", {})
        return result.get("pose") if hasattr(result, "get") else getattr(result, "pose", result)

    def look_at(self, position, target, up=None):
        params = {
            "position": [float(v) for v in position],
            "target": [float(v) for v in target],
        }
        if up is not None:
            params["up"] = [float(v) for v in up]
        result = _bridge("camera.look_at", params)
        return result.get("pose") if hasattr(result, "get") else getattr(result, "pose", result)

class Stage:
    """Browser Stage — same public name as CPython mv.Stage."""
    def __init__(self, name="default"):
        self.name = name
        self._camera = Camera(self)
        self._mode = "python"

    def draw(self, obj):
        # Full Frame draw needs molpy + binary path; keep explicit for now.
        print("[stage.draw] not yet bridged — use host file open / CPython Stage")
        return self

    @property
    def camera(self):
        return self._camera

    @property
    def mode(self):
        return self._mode

    @property
    def selection(self):
        return _SelectionStub()

    def run(self, script):
        return run(script)

class _SelectionStub:
    def frame(self):
        return None
    def set_atoms(self, ids):
        print("[stage.selection.set_atoms] not yet bridged", list(ids))
    def clear(self):
        print("[stage.selection.clear] not yet bridged")

def _normalize_script_name(name):
    s = str(name).strip().lstrip("/")
    if not s:
        raise ValueError("empty script name")
    return s if s.endswith(".py") else s + ".py"

def run(script, /, **_kwargs):
    """Execute a named script from the MolVis script library.

    >>> import molvis as mv
    >>> mv.run("camera.py")
    """
    key = _normalize_script_name(script)
    source = _MOLVIS_SCRIPTS.get(key)
    if source is None:
        known = ", ".join(sorted(_MOLVIS_SCRIPTS)) or "(none)"
        raise FileNotFoundError(
            f"script not found: {key!r}. Known: {known}"
        )
    g = {
        "__name__": f"__molvis_script__:{key}",
        "__file__": key,
        "mv": sys.modules.get("molvis"),
        "stage": stage,
        "math": math,
    }
    exec(compile(source, key, "exec"), g)
    return None

def list_scripts():
    return sorted(_MOLVIS_SCRIPTS.keys())

_mod = types.ModuleType("molvis")
_mod.Stage = Stage
_mod.run = run
_mod.list_scripts = list_scripts
_mod.__version__ = "0.0.0+pyodide"
sys.modules["molvis"] = _mod

stage = Stage()
_mod._default_stage = stage
`;

export class PyodideKernel {
  private status: KernelStatus = "idle";
  private pyodide: PyodideLike | null = null;
  private listeners = new Set<KernelListener>();
  private logs: KernelLogLine[] = [];
  private logSeq = 0;
  private runLock = false;
  private lastError: string | null = null;
  private scripts: Record<string, string> = {};
  private bridge: HostBridge | null = null;

  /** Bind (or re-bind) the live Molvis app bridge before/after start. */
  setBridge(bridge: HostBridge | null): void {
    this.bridge = bridge;
    if (this.pyodide && bridge) {
      this.pyodide.registerJsModule("molvis_host", {
        call: (method: string, params?: Record<string, unknown>) =>
          bridge.call(method, params ?? {}),
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
    if (!this.pyodide) return;
    const payload = JSON.stringify(this.scripts);
    await this.pyodide.runPythonAsync(`
import sys
_payload = __import__("json").loads(${JSON.stringify(payload)})
g = sys.modules.get("molvis")
if g is not None and hasattr(g, "run"):
    g.run.__globals__["_MOLVIS_SCRIPTS"] = _payload
`);
  }

  async start(): Promise<void> {
    if (this.pyodide) return;
    if (this.status === "loading") {
      await this.waitUntilReady();
      return;
    }
    this.setStatus("loading");
    this.lastError = null;
    this.pushLog({
      source: "system",
      stream: "info",
      text: "Loading Pyodide…",
    });
    try {
      this.pyodide = await loadPyodideFromCdn();
      // Register bridge BEFORE bootstrap imports molvis_host
      const bridge = this.bridge;
      this.pyodide.registerJsModule("molvis_host", {
        call: (method: string, params?: Record<string, unknown>) => {
          if (!this.bridge) {
            throw new Error("molvis host bridge not bound");
          }
          return this.bridge.call(method, params ?? {});
        },
      });
      if (!bridge) {
        this.pushLog({
          source: "system",
          stream: "info",
          text: "Host bridge not bound yet — camera calls will fail until app is ready.",
        });
      }
      await this.bootstrapNamespace();
      this.setStatus("ready");
      this.pushLog({
        source: "system",
        stream: "info",
        text: 'Pyodide ready. stage.camera.* is live; mv.run("camera.py") uses the script library.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.lastError = message;
      this.setStatus("error");
      this.pushLog({
        source: "system",
        stream: "stderr",
        text: `Failed to load Pyodide: ${message}`,
      });
      throw err;
    }
  }

  private async waitUntilReady(): Promise<void> {
    const start = Date.now();
    while (this.status === "loading" && Date.now() - start < 120_000) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (this.status === "error") {
      throw new Error(this.lastError ?? "kernel error");
    }
  }

  private async bootstrapNamespace(): Promise<void> {
    if (!this.pyodide) return;
    const payload = JSON.stringify(this.scripts);
    await this.pyodide.runPythonAsync(
      `_MOLVIS_SCRIPTS = __import__("json").loads(${JSON.stringify(payload)})\n` +
        BOOTSTRAP_PY,
    );
    try {
      await this.pyodide.loadPackage("micropip");
      await this.pyodide.runPythonAsync(
        `print("[kernel] micropip available; molpy wheel install TBD")`,
      );
    } catch {
      /* optional */
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
    if (!this.pyodide) {
      const msg = this.lastError ?? "Kernel not ready";
      return { ok: false, stdout: "", stderr: msg, error: msg };
    }

    this.runLock = true;
    this.setStatus("busy");
    let stdout = "";
    let stderr = "";

    this.pyodide.setStdout({
      batched: (s) => {
        stdout += s;
        this.pushLog({
          source,
          stream: "stdout",
          text: s,
          cellId: meta?.cellId,
        });
      },
    });
    this.pyodide.setStderr({
      batched: (s) => {
        stderr += s;
        this.pushLog({
          source,
          stream: "stderr",
          text: s,
          cellId: meta?.cellId,
        });
      },
    });

    try {
      const result = await this.pyodide.runPythonAsync(code);
      let resultText: string | undefined;
      if (result !== undefined && result !== null) {
        resultText = String(result);
        this.pushLog({
          source,
          stream: "stdout",
          text: resultText,
          cellId: meta?.cellId,
        });
      }
      this.setStatus("ready");
      return { ok: true, stdout, stderr, resultText };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushLog({
        source,
        stream: "stderr",
        text: message,
        cellId: meta?.cellId,
      });
      this.setStatus("ready");
      return { ok: false, stdout, stderr: stderr + message, error: message };
    } finally {
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

  async reset(): Promise<void> {
    this.pyodide = null;
    this.runLock = false;
    this.lastError = null;
    this.setStatus("idle");
    this.pushLog({
      source: "system",
      stream: "info",
      text: "Kernel reset.",
    });
    await this.start();
  }
}

let singleton: PyodideKernel | null = null;

export function getKernel(): PyodideKernel {
  if (!singleton) singleton = new PyodideKernel();
  return singleton;
}

export function _resetKernelSingleton(): void {
  singleton = null;
}
