import { PYODIDE_INDEX_URL } from "../cdn";
/**
 * Pyodide kernel — thin host only.
 *
 * Viewer control lives in **molvis-python**:
 *   ``InProcessTransport`` + ``Stage.from_inprocess`` → same RPC catalog as WS.
 *
 * This file only:
 *   1. loads Pyodide
 *   2. registers ``molvis_rpc.call`` → {@link createRpcClient} → RPCRouter
 *   3. runs a short Python bootstrap that imports molvis (not a TS string API)
 *   4. executes notebook / script cells as plain Python (shared __main__)
 */

import { createRpcClient, type RpcClient } from "../rpc/client";
import { installRuntimePackages } from "./install_runtime";
import type {
  KernelListener,
  KernelLogLine,
  KernelStatus,
  MimeBundle,
  RunResult,
  RunSource,
} from "./types";

export type CellRunPayload = {
  result: MimeBundle | null;
  displays: MimeBundle[];
  /** Captured by Python (redirect) — authoritative for cell output. */
  stdout: string;
  stderr: string;
};

/**
 * Normalize the value returned by ``run_user_cell_task``.
 *
 * Pyodide may hand back:
 *   - a JS string (JSON)
 *   - a PyProxy of a Python str / dict
 *   - a plain object (after toJs)
 *
 * Bug that ate all ``print`` output: a PyProxy-of-str was toJs'd into a
 * JS string, then rejected by ``typeof obj !== "object"`` → empty payload.
 */
export function parseCellPayload(raw: unknown): CellRunPayload {
  const empty: CellRunPayload = {
    result: null,
    displays: [],
    stdout: "",
    stderr: "",
  };
  if (raw == null) return empty;

  let obj: unknown = raw;

  // 1) Unwrap PyProxy first (Python str/dict/list).
  if (obj !== null && typeof obj === "object") {
    const proxy = obj as {
      toJs?: (opts?: Record<string, unknown>) => unknown;
      toString?: () => string;
    };
    if (typeof proxy.toJs === "function") {
      try {
        obj = proxy.toJs({
          dict_converter: Object.fromEntries,
          create_pyproxies: false,
        });
      } catch {
        // Fall through — may already be usable.
      }
    }
  }

  // 2) JSON string → object (native string *or* toJs of a Python str).
  if (typeof obj === "string") {
    const text = obj.trim();
    if (!text) return empty;
    try {
      obj = JSON.parse(text);
    } catch {
      return empty;
    }
  }

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return empty;
  }

  // Map (from some toJs paths) → plain record
  if (obj instanceof Map) {
    obj = Object.fromEntries(obj.entries());
  }

  const rec = obj as {
    result?: MimeBundle | null;
    displays?: MimeBundle[];
    stdout?: unknown;
    stderr?: unknown;
  };
  const result =
    rec.result && typeof rec.result === "object" && !Array.isArray(rec.result)
      ? rec.result
      : null;
  const displays = Array.isArray(rec.displays)
    ? rec.displays.filter((d) => d && typeof d === "object")
    : [];
  const stdout = typeof rec.stdout === "string" ? rec.stdout : "";
  const stderr = typeof rec.stderr === "string" ? rec.stderr : "";
  return { result, displays, stdout, stderr };
}

const PYODIDE_INDEX = PYODIDE_INDEX_URL;

type PyodideLike = {
  runPythonAsync: (code: string) => Promise<unknown>;
  /** Sync entry — usable from a click handler while a cell is mid-await. */
  runPython?: (code: string) => unknown;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
  loadPackage: (name: string | string[]) => Promise<void>;
  registerJsModule: (name: string, mod: Record<string, unknown>) => void;
  pyimport: (name: string) => unknown;
  setInterruptBuffer?: (buffer: TypedArray) => void;
  checkInterrupt?: () => void;
  FS: {
    writeFile: (path: string, data: string | Uint8Array) => void;
    mkdirTree?: (path: string) => void;
  };
};

type TypedArray = Uint8Array | Int32Array;

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

/**
 * Minimal glue: expose JS RPC + import molvis-python (InProcessTransport).
 * molvis + molpy are hard requirements — no stubs, no polyfills.
 * Viewer API: commands are methods on the stage — `stage.draw_frame(...)`.
 */
/**
 * Jupyter-compatible notebook cell runner (in-process Pyodide).
 *
 * Behaviour mirrors IPython InteractiveShell for the pieces we host:
 *   - shared __main__ namespace across cells (including user _names)
 *   - last expression auto-display via DisplayFormatter protocol
 *   - display() publishes display_data mid-cell
 *   - _ holds the last result
 *
 * Wire format for run_user_cell: JSON
 *   {"result": mimebundle|null, "displays": [mimebundle, ...]}
 */
const BOOTSTRAP_PY = `
import sys
import json
import base64
import ast as _ast

import molpy as mp  # hard requirement — do not stub
from molvis_rpc import call as _rpc_call
import molvis as mv

# ── Script library (plugin-local) ─────────────────────────────────────
_MOLVIS_SCRIPTS = dict(globals().get("_MOLVIS_SCRIPTS") or {})

def _normalize_script_name(name):
    s = str(name).strip().lstrip("/")
    if not s:
        raise ValueError("empty script name")
    return s if s.endswith(".py") else s + ".py"

# ── Wire molvis-python → page RPCRouter (catalog methods) ─────────────
# name="default" so mv.Stage() returns this same in-process stage.
stage = mv.Stage.from_inprocess(_rpc_call, name="default", gui=True)

def run_script(script, /, **_kwargs):
    key = _normalize_script_name(script)
    source = _MOLVIS_SCRIPTS.get(key)
    if source is None:
        known = ", ".join(sorted(_MOLVIS_SCRIPTS)) or "(none)"
        raise FileNotFoundError("script not found: %r. Known: %s" % (key, known))
    g = {
        "__name__": "__molvis_script__:%s" % key,
        "__file__": key,
        "mv": mv,
        "mp": mp,
        "stage": stage,
        "molvis": mv,
        "molpy": mp,
        "math": __import__("math"),
    }
    exec(compile(source, key, "exec"), g)

def list_scripts():
    return sorted(_MOLVIS_SCRIPTS.keys())

mv.run = run_script
mv.list_scripts = list_scripts

import __main__ as _MAIN

# ── Jupyter DisplayFormatter protocol ─────────────────────────────────
# Priority matches IPython.core.formatters.DisplayFormatter defaults.
_MIME_METHODS = (
    ("text/html", "_repr_html_"),
    ("text/markdown", "_repr_markdown_"),
    ("image/svg+xml", "_repr_svg_"),
    ("image/png", "_repr_png_"),
    ("image/jpeg", "_repr_jpeg_"),
    ("text/latex", "_repr_latex_"),
    ("application/json", "_repr_json_"),
    ("application/javascript", "_repr_javascript_"),
)
_IMAGE_MIMES = frozenset({"image/png", "image/jpeg", "image/gif"})

_DISPLAY_PUB = []  # mid-cell display() payloads for the current run


def _mime_encode(mime, value):
    """Normalize a formatter return value to a JSON-safe string."""
    if value is None:
        return None
    if mime in _IMAGE_MIMES:
        if isinstance(value, (bytes, bytearray, memoryview)):
            return base64.b64encode(bytes(value)).decode("ascii")
        # already base64 / data-url from some libraries
        return str(value)
    if mime == "application/json" and not isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, str):
        return value
    return str(value)


def format_mimebundle(obj, include=None, exclude=None):
    """Build a Jupyter mimebundle for *obj* (DisplayFormatter protocol).

    Order:
      1. obj._repr_mimebundle_(include=…, exclude=…) when present
      2. per-type _repr_*_ methods
      3. always text/plain via repr(obj) when nothing richer produced it
    """
    if obj is None:
        return None

    data = {}
    mime_fn = getattr(obj, "_repr_mimebundle_", None)
    if callable(mime_fn):
        try:
            try:
                bundle = mime_fn(include=include, exclude=exclude)
            except TypeError:
                bundle = mime_fn()
            if isinstance(bundle, tuple):
                bundle = bundle[0]  # (data, metadata)
            if isinstance(bundle, dict):
                for k, v in bundle.items():
                    enc = _mime_encode(str(k), v)
                    if enc is not None:
                        data[str(k)] = enc
        except Exception:
            data = {}

    if not data:
        for mime, method in _MIME_METHODS:
            if include is not None and mime not in include:
                continue
            if exclude is not None and mime in exclude:
                continue
            fn = getattr(obj, method, None)
            if not callable(fn):
                continue
            try:
                val = fn()
            except Exception:
                continue
            enc = _mime_encode(mime, val)
            if enc is not None:
                data[mime] = enc

    if "text/plain" not in data:
        try:
            data["text/plain"] = repr(obj)
        except Exception:
            data["text/plain"] = "<%s>" % type(obj).__name__

    if include is not None:
        keep = set(include)
        data = {k: v for k, v in data.items() if k in keep}
    if exclude is not None:
        drop = set(exclude)
        data = {k: v for k, v in data.items() if k not in drop}
    return data or None


def display(*objs, include=None, exclude=None, **_kwargs):
    """IPython.display.display — publish one mimebundle per object."""
    for obj in objs:
        bundle = format_mimebundle(obj, include=include, exclude=exclude)
        if bundle is not None:
            _DISPLAY_PUB.append(bundle)


def _seed_user_ns():
    """Shared notebook namespace = __main__ (cells share variables)."""
    ns = dict(_MAIN.__dict__)
    ns.update({
        "mv": mv,
        "mp": mp,
        "stage": stage,
        "molvis": mv,
        "molpy": mp,
        "math": __import__("math"),
        "sys": sys,
        "display": display,
    })
    return ns


def _write_user_ns(ns):
    """Persist cell bindings onto __main__ for the next cell.

    Jupyter keeps user names including single-underscore ones (_el, _).
    Only skip dunder protocol attrs (__name__, __builtins__, …).
    """
    for k, v in ns.items():
        if not isinstance(k, str):
            continue
        if k.startswith("__") and k.endswith("__"):
            continue
        _MAIN.__dict__[k] = v


async def _await_if_needed(value):
    if hasattr(value, "__await__") or callable(getattr(value, "then", None)):
        return await value
    return value


async def _exec_body(body, ns, flags):
    if not body:
        return
    mod = _ast.Module(body=list(body), type_ignores=[])
    code = compile(mod, "<cell>", "exec", flags=flags)
    await _await_if_needed(eval(code, ns, ns))


class _TeeIO:
    """Mirror writes to the live stream and a capture buffer.

    Cell output must not depend solely on Pyodide \`setStdout({batched})\`
    (which drops newlines and can miss prints under nested run_sync).
    """

    def __init__(self, primary, capture):
        self._primary = primary
        self._capture = capture

    def write(self, s):
        if not s:
            return 0
        self._capture.write(s)
        try:
            return self._primary.write(s)
        except Exception:
            return len(s)

    def flush(self):
        try:
            self._primary.flush()
        except Exception:
            pass
        try:
            self._capture.flush()
        except Exception:
            pass

    def isatty(self):
        return False

    @property
    def encoding(self):
        return getattr(self._primary, "encoding", "utf-8")

    def fileno(self):
        return self._primary.fileno()

    def writable(self):
        return True


async def run_user_cell(source):
    """Run one notebook cell; return JSON {result, displays, stdout, stderr}.

    Last top-level expression is evaluated and formatted (IPython style).
    Statements alone produce no execute_result.

    Cells starting with \`\`%%mv.demo\`\` run statement-at-a-time via
    :func:\`molvis.demo.run_demo\` (inter-step delay from \`\`delay=\`\`).

    \`print\` is captured into the payload so the notebook cell output
    always shows it (independent of setStdout quirks).
    """
    import io as _io
    import sys as _sys

    _DISPLAY_PUB.clear()
    ns = _seed_user_ns()
    flags = _ast.PyCF_ALLOW_TOP_LEVEL_AWAIT
    raw = source if source is not None else ""

    out_cap = _io.StringIO()
    err_cap = _io.StringIO()
    old_out, old_err = _sys.stdout, _sys.stderr
    _sys.stdout = _TeeIO(old_out, out_cap)
    _sys.stderr = _TeeIO(old_err, err_cap)

    result_bundle = None
    try:
        # ── %%mv.demo magic: step through top-level statements ───────────
        body_src, delay = mv.strip_demo_magic(raw)
        if delay is not None:
            await mv.demo(body_src, ns, delay=delay)
            _write_user_ns(ns)
        else:
            tree = _ast.parse(body_src, "<cell>", "exec")
            body = tree.body

            if not body:
                _write_user_ns(ns)
            else:
                last = body[-1]
                if isinstance(last, _ast.Expr):
                    await _exec_body(body[:-1], ns, flags)
                    expr = _ast.Expression(body=last.value)
                    code = compile(expr, "<cell>", "eval", flags=flags)
                    value = await _await_if_needed(eval(code, ns, ns))
                    # IPython: _ is the last result (including None).
                    ns["_"] = value
                    if value is not None:
                        result_bundle = format_mimebundle(value)
                else:
                    await _exec_body(body, ns, flags)

                _write_user_ns(ns)
    finally:
        try:
            _sys.stdout.flush()
            _sys.stderr.flush()
        except Exception:
            pass
        _sys.stdout = old_out
        _sys.stderr = old_err

    # Return a plain dict (not json.dumps). Pyodide converts it to a JS
    # object via toJs; a JSON *string* used to be discarded by parseCellPayload
    # when it arrived as a PyProxy-of-str (typeof after toJs === "string"
    # failed the object check → empty stdout forever).
    return {
        "result": result_bundle,
        "displays": list(_DISPLAY_PUB),
        "stdout": out_cap.getvalue(),
        "stderr": err_cap.getvalue(),
    }


_MOLVIS_CURRENT_CELL_TASK = None
_MOLVIS_INTERRUPT = False


def _stop_background_stage_work():
    """Best-effort: stop non-blocking camera orbits (and similar) on interrupt."""
    try:
        stage.camera.stop_track()
    except Exception:
        pass


def cancel_user_cell():
    """Cancel the active cell task + stop background stage work.

    Invoked from JS on the Interrupt button (must be sync and re-entrant —
    never schedule a second runPythonAsync while the cell is running).

    Sets molvis.interrupt so cooperative check() sites (demo delays,
    send_cmd) stop even when the current await is still finishing an RPC.
    The JS host also raises a pure-JS latch first; this path mirrors it
    into Python and cancels the asyncio task when re-entry is possible.
    """
    global _MOLVIS_INTERRUPT, _MOLVIS_CURRENT_CELL_TASK
    _MOLVIS_INTERRUPT = True
    try:
        import molvis_kernel_ctl as _ctl

        _ctl.request_interrupt()
    except Exception:
        pass
    try:
        import molvis.interrupt as _mi

        _mi.request()
    except Exception:
        pass
    _stop_background_stage_work()
    task = _MOLVIS_CURRENT_CELL_TASK
    if task is None or task.done():
        return False
    task.cancel("Interrupted by user")
    return True


def _clear_interrupt_flag():
    global _MOLVIS_INTERRUPT
    _MOLVIS_INTERRUPT = False
    try:
        import molvis_kernel_ctl as _ctl

        _ctl.clear_interrupt()
    except Exception:
        pass
    try:
        import molvis.interrupt as _mi

        _mi.clear()
    except Exception:
        pass


def _soft_sigint(_signum, _frame):
    """Map SIGINT to asyncio cancel — never raise KeyboardInterrupt into webloop.

    Writing 2 into Pyodide's interrupt buffer raises KeyboardInterrupt at random
    event-loop callbacks (webloop.run_handle / call_later), which shows up as
    uncaught PythonError spam. Cancelling the cell task is enough for demo /
    await cells on the main thread.
    """
    cancel_user_cell()


try:
    import signal as _signal

    _signal.signal(_signal.SIGINT, _soft_sigint)
except Exception:
    pass


async def run_user_cell_task(source):
    """Track the active cell so the UI can cancel it without a global signal."""
    global _MOLVIS_CURRENT_CELL_TASK
    import asyncio as _asyncio

    _clear_interrupt_flag()
    _MOLVIS_CURRENT_CELL_TASK = _asyncio.current_task()
    try:
        return await run_user_cell(source)
    except _asyncio.CancelledError:
        raise
    except KeyboardInterrupt as exc:
        # If SIGINT still leaked into the cell task, rethrow as cancel.
        raise _asyncio.CancelledError("Interrupted by user") from exc
    except BaseException as exc:
        # molvis.interrupt.InterruptRequested and similar cooperative stops.
        name = type(exc).__name__
        if name in ("InterruptRequested", "InterruptedError") or "Interrupted" in str(
            exc
        ):
            raise _asyncio.CancelledError("Interrupted by user") from exc
        raise
    finally:
        _MOLVIS_CURRENT_CELL_TASK = None
        _clear_interrupt_flag()


# Register a JS-callable cancel hook so Interrupt does not need a second
# runPythonAsync (which is serialized behind the active cell).
try:
    import molvis_kernel_ctl

    molvis_kernel_ctl.register_cancel(cancel_user_cell)
except Exception as _reg_err:
    print("molvis_kernel_ctl.register_cancel failed:", _reg_err)


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
  private rpc: RpcClient | null = null;
  private interruptBuffer: Uint8Array | null = null;
  /**
   * Pure-JS interrupt latch. Python ``molvis.interrupt.check`` polls this
   * via ``molvis_kernel_ctl.is_interrupt_requested`` — it must **not**
   * require re-entering Python while the cell is blocked in ``run_sync``.
   */
  private interruptRequested = false;
  /**
   * Sync Python cancel_user_cell, registered during bootstrap.
   * Called from the Interrupt button without a second runPythonAsync
   * (which would sit behind the active cell on Pyodide's API lock).
   */
  private cellCancel: (() => boolean) | null = null;

  /** Bind live app via RPCRouter (same catalog as WebSocket). */
  setApp(app: unknown | null): void {
    this.rpc = app ? createRpcClient(app) : null;
    if (this.pyodide) this.registerHostModules();
  }

  /** @deprecated use setApp */
  setBridge(bridge: { call: RpcClient["call"]; app?: unknown } | null): void {
    if (!bridge) {
      this.rpc = null;
    } else if ("app" in bridge && bridge.app) {
      this.rpc = createRpcClient(bridge.app);
    } else {
      // Legacy HostBridge-shaped object with .call only
      this.rpc = {
        app: null,
        call: (method, params) =>
          Promise.resolve(bridge.call(method, params ?? {})),
      };
    }
    if (this.pyodide) this.registerHostModules();
  }

  private registerHostModules(): void {
    if (!this.pyodide) return;
    this.pyodide.registerJsModule("molvis_rpc", {
      call: (method: string, params?: Record<string, unknown>) => {
        if (!this.rpc) {
          return Promise.reject(
            new Error("molvis RPC client not bound (app not ready)"),
          );
        }
        return this.rpc.call(method, params ?? {});
      },
    });
    // Kernel control surface: Python bootstrap registers cancel_user_cell here.
    // Also exposes a pure-JS interrupt latch that Python can poll without
    // waiting for a re-entrant cancel_user_cell call during run_sync.
    this.pyodide.registerJsModule("molvis_kernel_ctl", {
      register_cancel: (fn: unknown) => {
        this.cellCancel = () => invokePyCancel(fn);
      },
      request_interrupt: () => {
        this.interruptRequested = true;
      },
      clear_interrupt: () => {
        this.interruptRequested = false;
      },
      is_interrupt_requested: () => this.interruptRequested,
    });
  }

  private clearInterruptSignal(): void {
    if (this.interruptBuffer) this.interruptBuffer[0] = 0;
    this.interruptRequested = false;
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
_MOLVIS_SCRIPTS = __import__("json").loads(${JSON.stringify(payload)})
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
      // Prefer SharedArrayBuffer (true cooperative SIGINT). Fall back to a
      // plain ArrayBuffer so checkInterrupt still works when Python yields to JS
      // (RPC / await). Main-thread Pyodide cannot pre-empt pure Python loops.
      if (this.pyodide.setInterruptBuffer) {
        const storage =
          typeof SharedArrayBuffer !== "undefined"
            ? new SharedArrayBuffer(1)
            : new ArrayBuffer(1);
        this.interruptBuffer = new Uint8Array(storage);
        this.interruptBuffer[0] = 0;
        this.pyodide.setInterruptBuffer(this.interruptBuffer);
      }
      this.registerHostModules();
      if (!this.rpc) {
        this.pushLog({
          source: "system",
          stream: "info",
          text: "RPC client not bound yet — bind app before draw/camera calls.",
        });
      }
      this.pushLog({
        source: "system",
        stream: "info",
        text: "Local-dev stack: numpy + molrs (micropip) + monorepo molpy/molvis…",
      });
      await installRuntimePackages(this.pyodide);
      this.pushLog({
        source: "system",
        stream: "info",
        text: "Bootstrapping mv.Stage() (InProcessTransport → RPCRouter)…",
      });
      await this.bootstrapNamespace();
      this.setStatus("ready");
      this.pushLog({
        source: "system",
        stream: "info",
        text: "Pyodide ready · LOCAL-DEV molpy + molvis (Stage API).",
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
    // Hard-requires molvis (packed) + molpy (must already be importable).
    await this.pyodide.runPythonAsync(
      `_MOLVIS_SCRIPTS = __import__("json").loads(${JSON.stringify(payload)})\n` +
        BOOTSTRAP_PY,
    );
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
    this.clearInterruptSignal();
    let stdout = "";
    let stderr = "";

    // Prefer a write handler so newlines survive (batched strips them).
    // Cell UI still prefers Python-captured stdout from the payload.
    const onOut = (s: string) => {
      if (!s) return;
      stdout += s.endsWith("\n") || s.includes("\n") ? s : `${s}\n`;
      this.pushLog({
        source,
        stream: "stdout",
        text: s,
        cellId: meta?.cellId,
      });
    };
    const onErr = (s: string) => {
      if (!s) return;
      stderr += s.endsWith("\n") || s.includes("\n") ? s : `${s}\n`;
      this.pushLog({
        source,
        stream: "stderr",
        text: s,
        cellId: meta?.cellId,
      });
    };
    this.pyodide.setStdout({
      batched: onOut,
    });
    this.pyodide.setStderr({
      batched: onErr,
    });

    try {
      // Shared __main__ namespace so cells see each other's bindings.
      // Last expression → Jupyter mimebundle (execute_result).
      // ``%%mv.demo`` → molvis.demo.run_demo (statement pacing);
      // loops still use plain ``await asyncio.sleep`` / ``camera.track``.
      const raw = await this.pyodide.runPythonAsync(
        `await run_user_cell_task(${JSON.stringify(code)})\n`,
      );
      const payload = parseCellPayload(raw);
      this.setStatus("ready");
      const resultText = payload.result?.["text/plain"];
      // Prefer in-cell Python capture (authoritative for print).
      const cellStdout = payload.stdout || stdout;
      const cellStderr = payload.stderr || stderr;
      return {
        ok: true,
        stdout: cellStdout,
        stderr: cellStderr,
        data: payload.result ?? undefined,
        displays: payload.displays.length ? payload.displays : undefined,
        resultText,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const interrupted = isInterruptError(message);
      this.pushLog({
        source,
        stream: interrupted ? "info" : "stderr",
        text: interrupted ? "Execution stopped." : message,
        cellId: meta?.cellId,
      });
      this.setStatus("ready");
      return interrupted
        ? { ok: false, interrupted: true, stdout, stderr, error: "Execution stopped." }
        : { ok: false, stdout, stderr: stderr + message, error: message };
    } finally {
      this.runLock = false;
      this.clearInterruptSignal();
    }
  }

  async runNamedScript(name: string): Promise<RunResult> {
    const key = name.endsWith(".py") ? name : `${name}.py`;
    return this.run(
      `import molvis as mv\nmv.run(${JSON.stringify(key)})`,
      "script",
    );
  }

  /**
   * Stop the active cell (and any non-blocking camera track).
   *
   * Must **not** queue another ``runPythonAsync`` — that sits behind the
   * active cell on Pyodide's API lock and never runs until the cell ends.
   *
   * Do **not** write SIGINT (2) into the interrupt buffer on main-thread
   * Pyodide: that raises KeyboardInterrupt inside webloop callbacks
   * (run_handle / call_later) and floods the console with uncaught
   * PythonError.
   *
   * Order matters:
   *   1. Raise the **pure-JS** latch first so Python ``check()`` can see it
   *      from inside ``run_sync`` poll loops without re-entering Python.
   *   2. Best-effort re-entrant ``cancel_user_cell`` (task.cancel +
   *      ``molvis.interrupt.request`` + camera.stop_track).
   *   3. Never clear the JS latch here — ``run()`` / bootstrap clear it at
   *      the start of the next cell.
   */
  interrupt(): void {
    const busy = this.runLock;
    this.pushLog({
      source: "system",
      stream: "info",
      text: busy ? "Stopping current cell…" : "Stopping background work…",
    });

    // Pure-JS latch FIRST — works even when Python re-entry is blocked.
    this.interruptRequested = true;
    // Drop any leftover SIGINT so webloop does not raise mid-cancel.
    if (this.interruptBuffer) this.interruptBuffer[0] = 0;

    let cancelled = false;
    try {
      if (this.cellCancel) {
        cancelled = this.cellCancel();
      } else if (this.pyodide?.runPython) {
        // Fallback if bootstrap registration failed.
        const result = this.pyodide.runPython(
          "cancel_user_cell() if 'cancel_user_cell' in dir() else False",
        );
        cancelled = Boolean(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Cancel itself can surface KeyboardInterrupt if the buffer was set;
      // treat that as a successful stop request.
      if (isInterruptError(message)) {
        cancelled = true;
      } else {
        this.pushLog({
          source: "system",
          stream: "stderr",
          text: `Stop failed: ${message}`,
        });
      }
    }

    if (!busy && !cancelled) {
      this.pushLog({
        source: "system",
        stream: "info",
        text: "No running cell; requested camera stop if any.",
      });
    }
  }

  async reset(): Promise<void> {
    try {
      this.interrupt();
    } catch {
      /* ignore */
    }
    this.pyodide = null;
    this.interruptBuffer = null;
    this.cellCancel = null;
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

/** True when a thrown message indicates user interrupt / task cancel. */
export function isInterruptError(message: string): boolean {
  return /CancelledError|KeyboardInterrupt|InterruptRequested|Interrupted by user|InterruptedError|Execution stopped/i.test(
    message,
  );
}

/**
 * Call a Python cancel function exposed as a PyProxy or plain function.
 */
function invokePyCancel(fn: unknown): boolean {
  if (fn == null) return false;
  try {
    if (typeof fn === "function") {
      return Boolean((fn as () => unknown)());
    }
    // PyProxy: .callMethod / call as method
    const proxy = fn as {
      call?: (thisArg: unknown, ...args: unknown[]) => unknown;
      callMethod?: (name: string, ...args: unknown[]) => unknown;
    };
    if (typeof proxy.call === "function") {
      return Boolean(proxy.call(fn));
    }
    if (typeof proxy.callMethod === "function") {
      return Boolean(proxy.callMethod("__call__"));
    }
  } catch {
    return false;
  }
  return false;
}

let singleton: PyodideKernel | null = null;

export function getKernel(): PyodideKernel {
  if (!singleton) singleton = new PyodideKernel();
  return singleton;
}

export function _resetKernelSingleton(): void {
  singleton = null;
}
