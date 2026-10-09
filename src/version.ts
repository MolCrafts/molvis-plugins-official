import pkg from "../package.json";

/**
 * Meta collection identity (`com.molcrafts.plugins-official`).
 *
 * The npm workspace name is `@molcrafts/molvis-plugin-official`, the same
 * singular `molvis-plugin-` prefix as every child. It is a private
 * package: MolVis installs the GitHub repo `MolCrafts/molvis-plugins-official`.
 * The plugin id stays `com.molcrafts.plugins-official` so a host that
 * already loaded v0.5.0 keeps the same namespaced contributions.
 *
 * Plain semver. `minor` used to mean "number of child plugins", enforced by a
 * script; that spent a semver channel on a directory listing and made removing
 * a plugin a version *decrease* (0.4.0 → 0.3.0), which npm, jsDelivr pins and
 * every range read as a downgrade. The rule and its script are gone.
 *
 * Child packages under `plugins/*` keep their **own** independent versions.
 * Git tags for jsDelivr usually match this meta version (e.g. `v0.5.0`).
 */
export const PLUGIN_VERSION: string = pkg.version;

export const PLUGIN_ID = "com.molcrafts.plugins-official";

/**
 * Official children activated by the meta package (order = activate order).
 * `npm run check:official-plugins` asserts this matches `plugins/*`.
 */
export const OFFICIAL_PLUGINS = [
  "lammps-input-generator",
  "carbon-tube-builder",
  "alchemist",
  "pyodide-molpy",
] as const;

export type OfficialPluginId = (typeof OFFICIAL_PLUGINS)[number];
