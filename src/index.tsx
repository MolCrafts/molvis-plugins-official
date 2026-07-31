/**
 * Official meta-plugin — activates every package in this collection under
 * one host pluginId (`com.molcrafts.plugins-official`).
 *
 * Do not install both this meta package and the same child package at once
 * (duplicate toolbar buttons / commands).
 */

import { registerLammpsEqInput } from "../plugins/lammps-input-generator/src/index";
import { disposeWizardHost } from "../plugins/lammps-input-generator/src/commands/open-wizard/register";
import alchemistPlugin from "../plugins/alchemist/src/index";
import { registerPyodideMolpy } from "../plugins/pyodide-molpy/src/index";
import type {
  MolvisPluginModule,
  PluginAPI,
} from "../plugins/lammps-input-generator/src/types/plugin-api";

const plugin: MolvisPluginModule = {
  id: "com.molcrafts.plugins-official",
  name: "MolVis Plugins Official",
  version: "0.1.0",

  activate(api: PluginAPI) {
    api.log.info("plugins-official meta activate");
    registerLammpsEqInput(api);
    alchemistPlugin.activate(api);
    // Optional host surfaces (dialogs/panels/mode tabs) — requires molvis page
    // with PluginAPI extensions. Fail soft if an older host omits them.
    if (api.dialogs && api.panels && api.modes) {
      registerPyodideMolpy(api);
    } else {
      api.log.warn(
        "pyodide-molpy skipped: host PluginAPI missing dialogs/panels",
      );
    }
  },

  deactivate(api: PluginAPI) {
    disposeWizardHost();
    alchemistPlugin.deactivate?.(api);
    api.log.info("plugins-official meta deactivate");
  },
};

export default plugin;
