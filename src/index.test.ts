import { fakePluginAPI, mapStorage } from "@molcrafts/molvis-plugin/testing";
import type { MolvisPluginModule } from "@molcrafts/molvis-plugin";
import { describe, expect, it } from "@rstest/core";
import alchemistPlugin from "../plugins/alchemist/src/index";
import carbonTubePlugin from "../plugins/carbon-tube-builder/src/index";
import lammpsPlugin from "../plugins/lammps-input-generator/src/index";
import pyodidePlugin from "../plugins/pyodide-molpy/src/index";
import { OFFICIAL_PLUGINS } from "./version";

/**
 * Activating pyodide loads `@jupyterlite/pyodide-kernel` on purpose.
 * Importing it must not: that module needs the rsbuild `_pypi` substitution,
 * which rstest does not apply. The kernel import is dynamic, inside the
 * first notebook or script action.
 */
const TESTABLE_CHILDREN: readonly MolvisPluginModule[] = [
  lammpsPlugin,
  carbonTubePlugin,
  alchemistPlugin,
];

/** Records which PluginAPI domains a plugin actually touched. */
function recordingApi() {
  const touched = new Set<string>();
  const mark = (domain: string) => () => {
    touched.add(domain);
  };
  const api = fakePluginAPI({
    storage: mapStorage(),
    modifiers: { register: mark("modifiers") },
    modes: { register: mark("modes"), registerToolsPanel: mark("modes") },
    analysis: { register: mark("analysis") },
    commands: { register: mark("commands") },
    dialogs: { register: mark("dialogs") },
    panels: { register: mark("panels") },
    overlays: { add: mark("overlays") },
    settings: { registerSection: mark("settings") },
    caches: { register: mark("caches") },
    rpc: { registerMethod: mark("rpc") },
  });
  return { api, touched };
}

describe("official children", () => {
  it("imports the python plugin without starting the kernel runtime", () => {
    expect(pyodidePlugin.id).toBe("com.molcrafts.pyodide-molpy");
  });

  it("covers every plugin on the roster except activating the kernel", () => {
    // Activating pyodide pulls the runtime. The other children are activated
    // below. A new plugin must be added to one of those two groups.
    expect(TESTABLE_CHILDREN.length + 1).toBe(OFFICIAL_PLUGINS.length);
  });

  it("each child registers at least one contribution", () => {
    // Per child, not in aggregate: a total can stay non-zero while one child
    // silently registers nothing.
    for (const child of TESTABLE_CHILDREN) {
      const { api, touched } = recordingApi();
      child.activate(api);
      expect(touched.size, `${child.id} registered nothing`).toBeGreaterThan(0);
    }
  });

  it("each child can be deactivated without throwing", () => {
    // The collection tore down only alchemist for a while, so pyodide's
    // kernel singleton kept a reference to a dead app across reactivation.
    for (const child of TESTABLE_CHILDREN) {
      const { api } = recordingApi();
      child.activate(api);
      expect(() => child.deactivate?.(api), `${child.id}`).not.toThrow();
    }
  });

  it("each child declares a distinct plugin id", () => {
    const ids = TESTABLE_CHILDREN.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
