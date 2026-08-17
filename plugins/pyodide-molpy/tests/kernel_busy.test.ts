import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

describe("micropip install", () => {
  it("does not pass keep_going — a failed pin must stop the kernel", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/kernel/host_kernel.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/keep_going\s*=/);
  });
});
