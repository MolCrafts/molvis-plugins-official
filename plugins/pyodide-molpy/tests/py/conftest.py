"""Fakes for the browser globals ``rpc_bridge`` imports.

``rpc_bridge`` runs inside a Pyodide worker, so ``js`` and ``pyodide.ffi`` are
ambient there and absent here. Installing stand-ins in ``sys.modules`` before
the import is what makes the bridge testable at all — the reply decoding it
contains is where a silent kernel deadlock lived.
"""

import sys
import types
from pathlib import Path

import pytest

SRC_PY = Path(__file__).resolve().parents[2] / "src" / "py"


class JsUndefined:
    """Marker for a JS property that exists but holds ``undefined``."""


class FakeJsProxy:
    """Minimal stand-in for a Pyodide ``JsProxy`` over a JS object.

    Two behaviours matter and both are load-bearing:

    * it has **no** ``.get`` — it is not a mapping;
    * reading a property whose JS value is ``undefined`` raises
      ``AttributeError``, exactly like the real proxy.
    """

    def __init__(self, **fields):
        self._fields = fields

    def __getattr__(self, name):
        if name not in self._fields:
            raise AttributeError(name)
        value = self._fields[name]
        if isinstance(value, JsUndefined):
            raise AttributeError(name)
        return value


class FakeConsole:
    def __init__(self):
        self.warnings = []

    def warn(self, *args):
        self.warnings.append(" ".join(str(a) for a in args))


class FakeSelf:
    def __init__(self):
        self.posted = []
        self.listeners = []

    def postMessage(self, msg):
        self.posted.append(msg)

    def addEventListener(self, kind, handler):
        self.listeners.append((kind, handler))


@pytest.fixture
def bridge(monkeypatch):
    """Import a fresh ``rpc_bridge`` against fake browser globals."""
    js = types.ModuleType("js")
    js.console = FakeConsole()
    js.self = FakeSelf()
    js.Object = types.SimpleNamespace(fromEntries=dict)

    pyodide = types.ModuleType("pyodide")
    ffi = types.ModuleType("pyodide.ffi")
    ffi.create_proxy = lambda fn: fn
    ffi.to_js = lambda obj, **_kw: obj
    pyodide.ffi = ffi

    monkeypatch.setitem(sys.modules, "js", js)
    monkeypatch.setitem(sys.modules, "pyodide", pyodide)
    monkeypatch.setitem(sys.modules, "pyodide.ffi", ffi)
    monkeypatch.syspath_prepend(str(SRC_PY))
    monkeypatch.delitem(sys.modules, "rpc_bridge", raising=False)

    import rpc_bridge

    rpc_bridge._pending.clear()
    return rpc_bridge
