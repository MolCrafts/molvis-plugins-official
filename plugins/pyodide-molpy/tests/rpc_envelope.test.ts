import { describe, expect, test } from "@rstest/core";
import {
  RPC_REPLY_KEYS,
  rpcFailure,
  rpcSuccess,
} from "../src/rpc/envelope";

/**
 * These assert **key presence**, not values.
 *
 * The reply is consumed by Python holding a `JsProxy`: a missing key is an
 * `AttributeError` inside the reply handler, not a defaulted field. A reply
 * that omitted `error` on success is what hung the kernel, so "every reply
 * carries every key" is the invariant under test.
 */
describe("rpcSuccess", () => {
  test("carries every reply key", () => {
    const reply = rpcSuccess("id-1", { pose: 1 });
    expect(Object.keys(reply).sort()).toEqual([...RPC_REPLY_KEYS].sort());
  });

  test("keeps error present as null rather than omitting it", () => {
    const reply = rpcSuccess("id-1", { pose: 1 });
    expect("error" in reply).toBe(true);
    expect(reply.error).toBeNull();
  });

  test("normalises a void command's undefined payload to null", () => {
    // `camera.fit` resolves to undefined; `{payload: undefined}` reads as a
    // missing property from Python, which is the bug this prevents.
    const reply = rpcSuccess("id-2", undefined);
    expect("payload" in reply).toBe(true);
    expect(reply.payload).toBeNull();
    expect(Object.values(reply).includes(undefined)).toBe(false);
  });
});

describe("rpcFailure", () => {
  test("carries every reply key", () => {
    const reply = rpcFailure("id-3", new Error("boom"));
    expect(Object.keys(reply).sort()).toEqual([...RPC_REPLY_KEYS].sort());
  });

  test("keeps payload present as null and reports the message", () => {
    const reply = rpcFailure("id-3", new Error("boom"));
    expect("payload" in reply).toBe(true);
    expect(reply.payload).toBeNull();
    expect(reply.ok).toBe(false);
    expect(reply.error).toBe("boom");
  });

  test("stringifies a non-Error rejection", () => {
    expect(rpcFailure("id-4", "plain string").error).toBe("plain string");
  });
});
