/**
 * LAMMPS input generator — MolVis page plugin.
 *
 * Domains: commands (wizard toolbar), settings (about), rpc (generate).
 */

import { disposeWizardHost, registerOpenWizard } from "./commands/open-wizard/register";
import { generateLammpsEqInput } from "./generate/generate";
import { defaultConfig } from "./model/defaults";
import type { LammpsEqConfig } from "./model/types";
import { registerAboutSettings } from "./settings/about/register";
import type { MolvisPluginModule, PluginAPI } from "./types/plugin-api";

/** Shared registration used by this package and the official meta-plugin. */
export function registerLammpsEqInput(api: PluginAPI): void {
  registerOpenWizard(api);
  registerAboutSettings(api);

  api.rpc.registerMethod("generate", (params) => {
    const config = (params.config as LammpsEqConfig | undefined) ?? defaultConfig();
    return { script: generateLammpsEqInput(config) };
  });
}

const plugin: MolvisPluginModule = {
  id: "com.molcrafts.lammps-input-generator",
  name: "LAMMPS Input Generator",
  version: "0.1.0",

  activate(api: PluginAPI) {
    api.log.info("lammps-input-generator activate");
    registerLammpsEqInput(api);
  },

  deactivate(api: PluginAPI) {
    disposeWizardHost();
    api.log.info("lammps-input-generator deactivate");
  },
};

export default plugin;
