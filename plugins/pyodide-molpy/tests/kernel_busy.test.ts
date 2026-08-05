import { describe, expect, it } from "@rstest/core";
import { isInterruptError } from "../src/kernel/errors";

describe("isInterruptError", () => {
  it("recognizes cancel / KeyboardInterrupt messages", () => {
    expect(isInterruptError("asyncio.exceptions.CancelledError")).toBe(true);
    expect(isInterruptError("CancelledError: Interrupted by user")).toBe(true);
    expect(isInterruptError("KeyboardInterrupt")).toBe(true);
    expect(isInterruptError("Traceback... KeyboardInterrupt")).toBe(true);
    expect(isInterruptError("ValueError: bad")).toBe(false);
  });
});
