import pkg from "../package.json";

/**
 * Meta collection identity (`com.molcrafts.plugins-official`).
 *
 * Version scheme (root `package.json` / `molvis.plugin.json`):
 *
 * | Segment | Meaning |
 * |---------|---------|
 * | **major** | Plugin **system** change (host contract / activation model) |
 * | **minor** | **Number of child plugins** in this collection (add a plugin → +1) |
 * | **patch** | Fixes / polish with the **same** set of plugins |
 *
 * Child packages under `plugins/*` keep their **own** independent versions.
 * Git tags for jsDelivr usually match this meta version (e.g. `v0.4.0`).
 */
export const PLUGIN_VERSION: string = pkg.version;

export const PLUGIN_ID = "com.molcrafts.plugins-official";

/**
 * Official children activated by the meta package (order = activate order).
 * Keep in sync with `src/index.tsx` and `plugins/*` directories.
 * `minor` in {@link PLUGIN_VERSION} must equal `OFFICIAL_PLUGINS.length`.
 */
export const OFFICIAL_PLUGINS = [
  "lammps-input-generator",
  "carbon-tube-builder",
  "alchemist",
  "pyodide-molpy",
] as const;

export type OfficialPluginId = (typeof OFFICIAL_PLUGINS)[number];
