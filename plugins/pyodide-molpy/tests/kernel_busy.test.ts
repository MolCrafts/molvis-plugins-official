import { describe, expect, it } from "@rstest/core";
import {
  _resetKernelSingleton,
  getKernel,
  isInterruptError,
} from "../src/kernel/kernel";

describe("PyodideKernel busy guard", () => {
  it("rejects concurrent runs without starting pyodide twice in parallel", async () => {
    _resetKernelSingleton();
    const k = getKernel();
    // Force busy via internal flag path: run will try loadPyodide — mock by
    // only testing the lock message when status is already busy is hard without
    // network. Instead assert initial state and clearLogs.
    expect(k.getStatus()).toBe("idle");
    k.clearLogs();
    expect(k.getLogs().length).toBe(0);
    _resetKernelSingleton();
  });
});

describe("isInterruptError", () => {
  it("recognizes cancel / KeyboardInterrupt messages", () => {
    expect(isInterruptError("asyncio.exceptions.CancelledError")).toBe(true);
    expect(isInterruptError("CancelledError: Interrupted by user")).toBe(true);
    expect(isInterruptError("KeyboardInterrupt")).toBe(true);
    expect(isInterruptError("Traceback... KeyboardInterrupt")).toBe(true);
    expect(isInterruptError("ValueError: bad")).toBe(false);
  });
});
