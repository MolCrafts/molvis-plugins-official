/**
 * LAMMPS input generator — MolVis page plugin.
 *
 * Domains: commands (wizard toolbar), settings (about), rpc (generate).
 */

import { registerOpenWizard } from "./commands/open-wizard/register";
import { generateLammpsEqInput } from "./generate/generate";
import { defaultConfig } from "./model/defaults";
import type { LammpsEqConfig } from "./model/types";
import { registerAboutSettings } from "./settings/about/register";
import type { MolvisPluginModule, PluginAPI } from "./types/plugin-api";
import {
  COMMANDS,
  LEGACY_STORAGE_KEY,
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
      api.storage.removeItem(LEGACY_STORAGE_KEY);
    },
  });

  registerOpenWizard(api);
  registerAboutSettings(api);

  api.rpc.registerMethod(COMMANDS.generate, (params) => {
    const config = (params.config as LammpsEqConfig | undefined) ?? defaultConfig();
    return { script: generateLammpsEqInput(config) };
  });
}

const plugin: MolvisPluginModule = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  version: PLUGIN_VERSION,

  activate(api: PluginAPI) {
    api.log.info("lammps-input-generator activate");
    registerLammpsEqInput(api);
  },

  deactivate(api: PluginAPI) {
    api.log.info("lammps-input-generator deactivate");
  },
};

export default plugin;
