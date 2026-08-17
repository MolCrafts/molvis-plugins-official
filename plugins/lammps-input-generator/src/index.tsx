/**
 * LAMMPS input generator — MolVis page plugin.
 *
 * Domains: commands (wizard toolbar), settings (about), rpc (generate).
 */

import { registerOpenWizard } from "./commands/open-wizard/register";
import { generateLammpsEqInput } from "./generate/generate";
import { defaultConfig, normalizeConfig } from "./model/defaults";
import type { LammpsEqConfig } from "./model/types";
import { MolvisPlugin, type PluginAPI } from "@molcrafts/molvis-plugin";
import {
  COMMANDS,
  PLUGIN_ID,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  STORAGE_KEY,
} from "./version";

/** Shared registration used by this package and the official meta-plugin. */
export function registerLammpsEqInput(api: PluginAPI): void {
  // The wizard draft rebuilds from defaults, so it is safe to drop. The
  // host cannot know that about an opaque key — this plugin says so.
  api.caches.register({
    id: "draft",
    label: "LAMMPS wizard draft",
    describe: () => (api.storage.getItem(STORAGE_KEY) ? "saved" : "empty"),
    clear: () => {
      api.storage.removeItem(STORAGE_KEY);
    },
  });

  registerOpenWizard(api);

  api.rpc.registerMethod(COMMANDS.generate, (params) => {
    // Normalize exactly as the wizard does, so an RPC caller and the UI
    // produce the same script from the same config.
    const config = normalizeConfig(params.config) ?? defaultConfig();
    return { script: generateLammpsEqInput(config) };
  });
}

class LammpsInputGenerator extends MolvisPlugin {
  readonly id = PLUGIN_ID;
  readonly name = PLUGIN_NAME;
  readonly version = PLUGIN_VERSION;

  activate(api: PluginAPI) {
    api.log.info("lammps-input-generator activate");
    registerLammpsEqInput(api);
  }

  deactivate(api: PluginAPI) {
    api.log.info("lammps-input-generator deactivate");
  }
}

export default new LammpsInputGenerator();
