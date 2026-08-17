import { describe, expect, it } from "@rstest/core";
import {
  MICROPIP_REQUIREMENTS,
  MOLVIS_WHEEL,
  PYODIDE_PACKAGES,
  PYODIDE_VERSION,
} from "../src/cdn";

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
    const names = MICROPIP_REQUIREMENTS.map((r) => r.split("==")[0]);
    expect(names).toContain("molcrafts-molpy");
    expect(names).toContain("molcrafts-molrs");
    expect(names).toContain("molcrafts-molvis");
    expect(MICROPIP_REQUIREMENTS).toContain("molcrafts-molvis==0.2.0");
    expect(names).not.toContain("numpy");
    expect(PYODIDE_PACKAGES).toContain("numpy");
    expect(PYODIDE_PACKAGES).toContain("micropip");
    expect(MOLVIS_WHEEL).toMatch(/^molcrafts_molvis-.+-py3-none-any\.whl$/);
  });
});
