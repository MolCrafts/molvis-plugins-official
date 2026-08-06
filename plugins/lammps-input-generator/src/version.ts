import pkg from "../package.json";

/**
 * Single source of truth for this plugin's version.
 *
 * `package.json`, `molvis.plugin.json` and the plugin module literal used to
 * each carry their own copy, and had already drifted (0.1.2 / 0.1.0 / 0.1.0)
 * — with the stale value ending up in the provenance header of every
 * generated LAMMPS script. Everything now reads this constant, and
 * `molvis.plugin.json` is generated from `package.json` at build time.
 */
export const PLUGIN_VERSION: string = pkg.version;

export const PLUGIN_ID = "com.molcrafts.lammps-input-generator";
export const PLUGIN_NAME = "LAMMPS Template";

/** Host namespaces these as `plugin.<PLUGIN_ID>.<id>` — do not pre-prefix. */
export const DIALOG_ID = "wizard";

export const COMMANDS = {
  openWizard: "open-wizard",
  generate: "generate",
} as const;

/** localStorage key for the persisted wizard draft. */
export const STORAGE_KEY = "lammps-input-config-v3";

/** Filename offered when downloading the generated script. */
export const DEFAULT_SCRIPT_FILENAME = "in.eq";
