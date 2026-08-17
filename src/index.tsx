/**
 * Official meta-plugin — activates every package in this collection under
 * one host pluginId (`com.molcrafts.plugins-official`).
 *
 * Do not install both this meta package and the same child package at once
 * (duplicate toolbar buttons / commands).
 */

import alchemistPlugin from "../plugins/alchemist/src/index";
import carbonTubePlugin from "../plugins/carbon-tube-builder/src/index";
import lammpsPlugin from "../plugins/lammps-input-generator/src/index";
import pyodidePlugin from "../plugins/pyodide-molpy/src/index";
import {
  MolvisPlugin,
  type MolvisPluginModule,
  type PluginAPI,
} from "@molcrafts/molvis-plugin";
import { PLUGIN_ID, PLUGIN_VERSION } from "./version";

/**
 * The children, in activate order. Deactivate walks it in reverse.
 *
 * Holding them in one list is what keeps activate and deactivate symmetric:
 * this used to call four `register*()` functions and then tear down only
 * alchemist, so `pyodide-molpy`'s `getKernel().setApp(null)` never ran and a
 * module-level kernel singleton kept a reference to a dead app across
 * deactivate/reactivate.
 */
const CHILDREN: readonly MolvisPluginModule[] = [
  lammpsPlugin,
  carbonTubePlugin,
  alchemistPlugin,
  pyodidePlugin,
];

class OfficialPlugins extends MolvisPlugin {
  readonly id = PLUGIN_ID;
  readonly name = "MolVis Plugins Official";
  readonly version = PLUGIN_VERSION;

  activate(api: PluginAPI) {
    api.log.info("plugins-official meta activate");
    // Every child registers unconditionally. The contract comes from one
    // source now, so probing `api.dialogs && api.panels` at runtime would
    // only hide a genuine host/plugin mismatch behind a silently missing
    // feature — which is how pyodide-molpy could disappear with one warn().
    for (const child of CHILDREN) child.activate(api);
  }

  deactivate(api: PluginAPI) {
    for (const child of [...CHILDREN].reverse()) child.deactivate?.(api);
    api.log.info("plugins-official meta deactivate");
  }
}

export { CHILDREN };

export default new OfficialPlugins();
