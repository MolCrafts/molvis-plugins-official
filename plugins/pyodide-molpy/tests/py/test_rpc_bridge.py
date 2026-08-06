"""The reply path that once deadlocked every cell that touched the stage."""

import asyncio
import re

import pytest
from conftest import FakeJsProxy, JsUndefined


class TestField:
    def test_reads_a_present_value(self, bridge):
        data = FakeJsProxy(payload={"radius": 2.0})
        assert bridge.field(data, "payload") == {"radius": 2.0}

    def test_returns_the_default_for_an_absent_key(self, bridge):
        # A success reply carries no 'error' key at all.
        assert bridge.field(FakeJsProxy(ok=True), "error") is None

    def test_returns_the_default_for_an_undefined_value(self, bridge):
        # A void command's payload is JS `undefined`; reading it on a real
        # JsProxy raises AttributeError rather than yielding None.
        data = FakeJsProxy(payload=JsUndefined())
        assert bridge.field(data, "payload", "fallback") == "fallback"

    def test_does_not_use_a_mapping_accessor(self, bridge):
        # The regression: `data.get(name)` on a JsProxy raised
        # AttributeError('get'), a bare except swallowed it, and the pending
        # future was never resolved. A JsProxy has no `.get`, so any
        # reintroduction of that fallback fails right here.
        data = FakeJsProxy(type="molvis_rpc_reply")
        assert not hasattr(data, "get")
        assert bridge.field(data, "anything") is None


class TestOnHostMessage:
    def _reply(self, bridge, **fields):
        loop = asyncio.new_event_loop()
        try:
            fut = loop.create_future()
            bridge._pending["req-1"] = fut
            event = FakeJsProxy(
                data=FakeJsProxy(type="molvis_rpc_reply", id="req-1", **fields)
            )
            bridge.on_host_message(event)
            return fut
        finally:
            loop.close()

    def test_resolves_a_success_reply_that_omits_error(self, bridge):
        # Exactly the shape the host sent while cells hung forever.
        fut = self._reply(bridge, ok=True, payload={"radius": 2.0})
        assert fut.done()
        assert fut.result() == {"radius": 2.0}

    def test_resolves_a_void_command_with_no_payload(self, bridge):
        fut = self._reply(bridge, ok=True)
        assert fut.done()
        assert fut.result() is None

    def test_rejects_a_failure_reply(self, bridge):
        fut = self._reply(bridge, ok=False, error="camera.fit failed")
        assert fut.done()
        with pytest.raises(RuntimeError, match=re.escape("camera.fit failed")):
            fut.result()

    def test_ignores_traffic_from_other_transports(self, bridge):
        loop = asyncio.new_event_loop()
        try:
            fut = loop.create_future()
            bridge._pending["req-1"] = fut
            bridge.on_host_message(FakeJsProxy(data=FakeJsProxy(type="comlink")))
            assert not fut.done()
            assert "req-1" in bridge._pending
        finally:
            loop.close()

    def test_warns_and_drops_a_reply_without_an_id(self, bridge):
        import js

        bridge.on_host_message(
            FakeJsProxy(data=FakeJsProxy(type="molvis_rpc_reply", ok=True))
        )
        assert any("without an id" in w for w in js.console.warnings)

    def test_a_second_reply_for_the_same_id_is_dropped(self, bridge):
        fut = self._reply(bridge, ok=True, payload=1)
        assert fut.result() == 1
        # No pending entry left, so a duplicate must not raise InvalidStateError.
        bridge.on_host_message(
            FakeJsProxy(
                data=FakeJsProxy(type="molvis_rpc_reply", id="req-1", ok=True)
            )
        )
