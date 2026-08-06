/**
 * Official meta-plugin — activates every package in this collection under
 * one host pluginId (`com.molcrafts.plugins-official`).
 *
 * Do not install both this meta package and the same child package at once
 * (duplicate toolbar buttons / commands).
 */

import alchemistPlugin from "../plugins/alchemist/src/index";
import { registerCarbonTubeBuilder } from "../plugins/carbon-tube-builder/src/index";
import { registerLammpsEqInput } from "../plugins/lammps-input-generator/src/index";
import { registerPyodideMolpy } from "../plugins/pyodide-molpy/src/index";
import type { MolvisPluginModule, PluginAPI } from "@molcrafts/molvis-plugin";
import { PLUGIN_ID, PLUGIN_VERSION } from "./version";

const plugin: MolvisPluginModule = {
  id: PLUGIN_ID,
  name: "MolVis Plugins Official",
  version: PLUGIN_VERSION,

  activate(api: PluginAPI) {
    api.log.info("plugins-official meta activate");
    registerLammpsEqInput(api);
    registerCarbonTubeBuilder(api);
    alchemistPlugin.activate(api);
    // Every child registers unconditionally. The contract is vendored from
    // one source now, so probing `api.dialogs && api.panels` at runtime would
    // only hide a genuine host/plugin mismatch behind a silently missing
    // feature — which is how pyodide-molpy could disappear with one warn().
    registerPyodideMolpy(api);
  },

  deactivate(api: PluginAPI) {
    alchemistPlugin.deactivate?.(api);
    api.log.info("plugins-official meta deactivate");
  },
};

export default plugin;
