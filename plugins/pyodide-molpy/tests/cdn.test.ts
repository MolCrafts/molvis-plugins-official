import { describe, expect, it } from "@rstest/core";
import { MICROPIP_REQUIREMENTS, PYODIDE_VERSION } from "../src/cdn";

describe("runtime pins", () => {
  it("pins every micropip requirement to an exact version", () => {
    // These packages are fetched at runtime, so they appear in no
    // package.json, no lockfile and no dependency scanner — an unpinned entry
    // lets an upstream release change the runtime under an already published
    // bundle. Four of them were unpinned in the same file that warned about
    // exactly that.
    const unpinned = MICROPIP_REQUIREMENTS.filter((r) => !r.includes("=="));
    expect(unpinned).toEqual([]);
  });

  it("pins pyodide itself", () => {
    expect(PYODIDE_VERSION).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it("installs the python packages the kernel bootstrap imports", () => {
    // molvis_setup.py does `import molvis as mv` and optionally `import molpy`;
    // both must come from micropip now that the vendored wheels are gone.
    const names = MICROPIP_REQUIREMENTS.map((r) => r.split("==")[0]);
    expect(names).toContain("molcrafts-molvis");
    expect(names).toContain("molcrafts-molpy");
  });
});
