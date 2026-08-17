"""Wire molvis-python onto the RPC bridge and expose it to notebook cells.

Runs after ``rpc_bridge.py`` in the same interpreter, as a separate kernel
execution so a failure here is attributed to this stage rather than to one
130-line blob.

``numpy`` comes from the Pyodide lock file. ``molpy`` / ``molrs`` come
from micropip (molrs publishes an emscripten wheel). Local ``molvis`` is
the sibling checkout on ``sys.path``.
"""

import molvis as mv

stage = mv.Stage.from_inprocess(invoke, name="default", gui=True)

#: Script library; the host replaces it wholesale via ``syncScripts``.
_MOLVIS_SCRIPTS: dict[str, str] = {}


def _normalize_script_name(name):
    text = str(name).strip().lstrip("/")
    if not text:
        raise ValueError("empty script name")
    return text if text.endswith(".py") else text + ".py"


def run_script(script, /, **_kwargs):
    key = _normalize_script_name(script)
    source = _MOLVIS_SCRIPTS.get(key)
    if source is None:
        known = ", ".join(sorted(_MOLVIS_SCRIPTS)) or "(none)"
        raise FileNotFoundError(f"script not found: {key!r}. Known: {known}")
    scope = {
        "__name__": f"__molvis_script__:{key}",
        "__file__": key,
        "mv": mv,
        "molvis": mv,
        "stage": stage,
        "math": __import__("math"),
    }
    try:
        import molpy as mp

        scope["mp"] = mp
        scope["molpy"] = mp
    except ImportError:
        pass
    exec(compile(source, key, "exec"), scope)


def list_scripts():
    return sorted(_MOLVIS_SCRIPTS)


mv.run = run_script
mv.list_scripts = list_scripts

# ── %%mv.demo ────────────────────────────────────────────────────────────
# molvis already registers this when imported into a live shell; call the
# public entry point anyway so the kernel does not depend on import order.
# Idempotent by contract.
from IPython import get_ipython  # noqa: E402

mv.load_ipython_extension(get_ipython())

# Expose for subsequent cells / host inject.
import __main__ as _MAIN  # noqa: E402

_MAIN.stage = stage
_MAIN.mv = mv
_MAIN.molvis = mv
try:
    import molpy as _mp

    _MAIN.mp = _mp
    _MAIN.molpy = _mp
except ImportError:
    pass

print("[molvis] pyodide-kernel ready · Stage → host RPCRouter")
