import { fakePluginAPI, mapStorage } from "@molcrafts/molvis-plugin/testing";
import type { MolvisPluginModule } from "@molcrafts/molvis-plugin";
import { describe, expect, it } from "@rstest/core";
import alchemistPlugin from "../plugins/alchemist/src/index";
import carbonTubePlugin from "../plugins/carbon-tube-builder/src/index";
import lammpsPlugin from "../plugins/lammps-input-generator/src/index";
import { OFFICIAL_PLUGINS } from "./version";

/**
 * Children exercised here.
 *
 * `pyodide-molpy` is deliberately absent. `src/index.tsx` source-imports every
 * child, and pyodide's entry eagerly imports `@jupyterlite/pyodide-kernel`,
 * whose `kernel.js` requires a `_pypi` module upstream does not ship. The
 * build substitutes it with `NormalModuleReplacementPlugin`
 * (rsbuild.plugin-shared.ts), but rstest resolves node_modules through node's
 * own loader, so the substitution does not apply and importing the collection
 * throws at module load.
 *
 * That is a real architectural constraint, not a test-harness quirk: the
 * artifact that actually ships cannot be imported outside its bundler. The
 * fix is for pyodide-molpy to load the kernel lazily (it is only needed once
 * the Python mode activates), which would also shrink the collection bundle.
 * Until then this file covers the three children it can, and the collection's
 * own wiring is covered only by the build.
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
  it("covers every plugin on the roster except the kernel one", () => {
    // If a plugin is added to OFFICIAL_PLUGINS, this fails until it is either
    // exercised here or explicitly documented above as untestable.
    expect(TESTABLE_CHILDREN.length).toBe(OFFICIAL_PLUGINS.length - 1);
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
