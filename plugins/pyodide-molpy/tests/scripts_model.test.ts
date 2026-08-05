import { describe, expect, it } from "@rstest/core";
import {
  defaultLibrary,
  getScriptSource,
  listScriptNames,
  normalizeScriptName,
  scriptsMap,
  upsertScript,
} from "../src/model/scripts";

describe("script library model", () => {
  it("normalizes names to .py", () => {
    expect(normalizeScriptName("camera")).toBe("camera.py");
    expect(normalizeScriptName("camera.py")).toBe("camera.py");
  });

  it("ships camera.py by default", () => {
    const lib = defaultLibrary();
    expect(listScriptNames(lib)).toContain("camera.py");
    expect(getScriptSource(lib, "camera")).toContain("stage.camera.track");
  });

  it("upserts and maps sources for kernel sync", () => {
    let lib = defaultLibrary();
    lib = upsertScript(lib, "orbit.py", "print(1)\n");
    const map = scriptsMap(lib);
    expect(map["orbit.py"]).toBe("print(1)\n");
    expect(lib.active).toBe("orbit.py");
  });
});
