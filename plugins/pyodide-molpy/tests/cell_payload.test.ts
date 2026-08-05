import { describe, expect, it } from "@rstest/core";
import { parseCellPayload } from "../src/kernel/kernel";

describe("parseCellPayload", () => {
  it("parses a JSON string with stdout", () => {
    const raw = JSON.stringify({
      result: null,
      displays: [],
      stdout: "hello from print\n",
      stderr: "",
    });
    const p = parseCellPayload(raw);
    expect(p.stdout).toBe("hello from print\n");
    expect(p.stderr).toBe("");
    expect(p.result).toBeNull();
  });

  it("parses a plain object with stdout", () => {
    const p = parseCellPayload({
      result: { "text/plain": "42" },
      displays: [],
      stdout: "line1\nline2\n",
      stderr: "warn\n",
    });
    expect(p.stdout).toBe("line1\nline2\n");
    expect(p.stderr).toBe("warn\n");
    expect(p.result).toEqual({ "text/plain": "42" });
  });

  it("unwraps a PyProxy-like toJs that yields a JSON string (the print bug)", () => {
    // Historical failure mode: runPythonAsync returned a PyProxy of a
    // Python str(json.dumps(...)). toJs → JS string; old parser then did
    // typeof obj !== "object" and dropped everything, including stdout.
    const json = JSON.stringify({
      result: null,
      displays: [],
      stdout: "caffeine: …\n",
      stderr: "",
    });
    const proxy = {
      toJs: () => json,
    };
    const p = parseCellPayload(proxy);
    expect(p.stdout).toBe("caffeine: …\n");
  });

  it("unwraps a PyProxy-like toJs that yields a plain object", () => {
    const proxy = {
      toJs: () => ({
        result: null,
        displays: [],
        stdout: "style: spacefill\n",
        stderr: "",
      }),
    };
    const p = parseCellPayload(proxy);
    expect(p.stdout).toBe("style: spacefill\n");
  });

  it("unwraps Map from toJs dict_converter edge cases", () => {
    const p = parseCellPayload(
      new Map<string, unknown>([
        ["result", null],
        ["displays", []],
        ["stdout", "via map\n"],
        ["stderr", ""],
      ]),
    );
    expect(p.stdout).toBe("via map\n");
  });

  it("returns empty for garbage", () => {
    expect(parseCellPayload(undefined).stdout).toBe("");
    expect(parseCellPayload("not-json").stdout).toBe("");
    expect(parseCellPayload(42).stdout).toBe("");
  });
});
