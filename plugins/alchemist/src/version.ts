import pkg from "../package.json";

/**
 * Identity and contribution ids in one place.
 *
 * The version used to be written in `package.json`, `molvis.plugin.json` and
 * the plugin module literal independently, and had already drifted. Command
 * and dialog ids were bare literals shared between the registration site and
 * its tests, with no compiler check that they matched.
 */
export const PLUGIN_VERSION: string = pkg.version;

export const PLUGIN_ID = "com.molcrafts.alchemist";
export const PLUGIN_NAME = "Alchemist";

/** Host namespaces these as `plugin.<PLUGIN_ID>.<id>` — do not pre-prefix. */
export const DIALOG_ID = "game";

export const COMMANDS = {
  open: "open",
} as const;
