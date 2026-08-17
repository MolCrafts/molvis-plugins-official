"""Molvis RPC bridge: kernel worker <-> host, over ``postMessage``.

Runs inside the JupyterLite Pyodide worker. Deliberately imports no ``molvis``
/ ``molpy``, so ``tests/py/`` can exercise the reply decoding with a fake
``js`` module.
"""

import asyncio
import uuid

import js
from pyodide.ffi import create_proxy, to_js

#: Pending request id -> future awaiting the host reply.
_pending: dict[str, asyncio.Future] = {}


def field(obj, name, default=None):
    """Read one field off a host reply.

    The reply is a ``JsProxy``, not a dict: no ``.get``, and reading a property
    whose JS value is ``undefined`` raises ``AttributeError``. A dict-style
    accessor here raises on every reply that omits a key, which strands the
    pending future. Never reintroduce one.
    """
    value = getattr(obj, name, default)
    return default if value is None else value


def on_host_message(event) -> None:
    """Resolve the pending future for one ``molvis_rpc_reply``.

    Ignores every other message on the worker channel — Comlink and
    coincident share it.
    """
    data = getattr(event, "data", None)
    if data is None:
        return
    if field(data, "type") != "molvis_rpc_reply":
        return
    req_id = field(data, "id")
    if req_id is None:
        js.console.warn("[molvis] RPC reply without an id; dropping")
        return
    fut = _pending.pop(str(req_id), None)
    if fut is None or fut.done():
        return
    if field(data, "ok", True):
        fut.set_result(field(data, "payload"))
    else:
        fut.set_exception(
            RuntimeError(str(field(data, "error") or "molvis RPC failed"))
        )


async def rpc_call(method, params=None):
    """Send one request and await the host reply."""
    req_id = str(uuid.uuid4())
    fut = asyncio.get_running_loop().create_future()
    _pending[req_id] = fut
    msg = {
        "type": "molvis_rpc",
        "id": req_id,
        "method": method,
        "params": params or {},
    }
    js.self.postMessage(to_js(msg, dict_converter=js.Object.fromEntries))
    return await fut


def invoke(method, params):
    """Synchronous view of :func:`rpc_call` for ``InProcessTransport``.

    ``run_sync`` needs stack switching (JSPI); without it the caller gets the
    awaitable. Only that missing-capability case is caught — a *failing* RPC
    must surface as the failure, not degrade into an unusable coroutine.
    """
    coro = rpc_call(method, params)
    try:
        from pyodide.ffi import run_sync
    except ImportError:
        return coro
    return run_sync(coro)


#: Kept alive for the lifetime of the worker; dropping it unbinds the listener.
_listener = create_proxy(on_host_message)
js.self.addEventListener("message", _listener)
