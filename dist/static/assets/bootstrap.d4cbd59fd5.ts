/**
 * Python bootstrap run once after the JupyterLite pyodide-kernel is ready.
 *
 * - Installs scientific deps via piplite/micropip
 * - Puts monorepo molvis/molpy on sys.path (files written under /home/pyodide/local_py)
 * - Wires Stage → main-thread RPC via postMessage bridge (Worker → host)
 */

export const BOOTSTRAP_PY = `
import sys
import json
import pathlib
import uuid
import asyncio
from pyodide.ffi import create_proxy, to_js

# ── Local monorepo pack (written by host into Contents / FS) ─────────
# Host writes monorepo pack under /home/pyodide/packages (LOCAL_PY_ROOT).
_LOCAL = pathlib.Path("/home/pyodide/packages")
if _LOCAL.is_dir() and str(_LOCAL) not in sys.path:
    sys.path.insert(0, str(_LOCAL))

# Prefer local pack over any earlier install.
for _k in list(sys.modules):
    if _k in ("molpy", "molvis") or _k.startswith("molpy.") or _k.startswith("molvis."):
        del sys.modules[_k]

# ── Molvis RPC bridge (Worker postMessage ↔ host RPCRouter) ──────────
import js

_pending = {}
_rpc_ready = False

def _on_host_message(event):
    data = event.data
    if data is None:
        return
    # Comlink / coincident traffic is ignored.
    try:
        typ = data.type if hasattr(data, "type") else data.get("type")
    except Exception:
        return
    if typ != "molvis_rpc_reply":
        return
    try:
        req_id = data.id if hasattr(data, "id") else data["id"]
        ok = data.ok if hasattr(data, "ok") else data.get("ok", True)
        payload = data.payload if hasattr(data, "payload") else data.get("payload")
        err = data.error if hasattr(data, "error") else data.get("error")
    except Exception:
        return
    fut = _pending.pop(str(req_id), None)
    if fut is None or fut.done():
        return
    if ok:
        fut.set_result(payload)
    else:
        fut.set_exception(RuntimeError(str(err or "molvis RPC failed")))

_proxy = create_proxy(_on_host_message)
js.self.addEventListener("message", _proxy)
_rpc_ready = True

async def _rpc_call(method, params=None):
    if not _rpc_ready:
        raise RuntimeError("molvis RPC bridge not ready")
    req_id = str(uuid.uuid4())
    loop = asyncio.get_running_loop()
    fut = loop.create_future()
    _pending[req_id] = fut
    msg = {
        "type": "molvis_rpc",
        "id": req_id,
        "method": method,
        "params": params or {},
    }
    js.self.postMessage(to_js(msg, dict_converter=js.Object.fromEntries))
    return await fut

# ── Install molvis-python against the bridge ─────────────────────────
import molvis as mv
from molvis.transport import InProcessTransport

def _invoke(method, params):
    # InProcessTransport may call sync; schedule the async RPC and
    # resolve via pyodide.ffi.run_sync when available.
    coro = _rpc_call(method, params)
    try:
        from pyodide.ffi import run_sync
        return run_sync(coro)
    except Exception:
        # Fallback: return awaitable for async cells.
        return coro

stage = mv.Stage.from_inprocess(_invoke, name="default", gui=True)

# Script library placeholder (host may overwrite via syncScripts).
_MOLVIS_SCRIPTS = {}

def _normalize_script_name(name):
    s = str(name).strip().lstrip("/")
    if not s:
        raise ValueError("empty script name")
    return s if s.endswith(".py") else s + ".py"

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
        "stage": stage,
        "molvis": mv,
        "math": __import__("math"),
    }
    try:
        import molpy as mp
        g["mp"] = mp
        g["molpy"] = mp
    except Exception:
        pass
    exec(compile(source, key, "exec"), g)

def list_scripts():
    return sorted(_MOLVIS_SCRIPTS.keys())

mv.run = run_script
mv.list_scripts = list_scripts

# Expose for subsequent cells / host inject.
import __main__ as _MAIN
_MAIN.stage = stage
_MAIN.mv = mv
_MAIN.molvis = mv
try:
    import molpy as mp
    _MAIN.mp = mp
    _MAIN.molpy = mp
except Exception:
    pass

print("[molvis] pyodide-kernel ready · Stage → host RPCRouter")
`;
