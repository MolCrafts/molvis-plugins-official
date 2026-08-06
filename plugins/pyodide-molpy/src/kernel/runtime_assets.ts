/**
 * Runtime layout for the pyodide kernel package.
 *
 * Build emits (via rsbuild `output.copy`, not a post-hoc shell script):
 *
 *   dist/
 *     plugin.js
 *     comlink.worker.js | coincident.worker.js
 *     all.json
 *     piplite-*.whl  (+ other piplite index wheels)
 *
 * Host loads plugin.js from a network URL (local serve or GitHub Release).
 * Sibling assets are resolved against that entry URL — never against
 * webpack `publicPath` or a frozen `import.meta.url` file: path.
 */

/** Set by molvis host blob loader before `import(plugin)`. */
export type MolvisPluginGlobals = {
  __MOLVIS_PLUGIN_ENTRY__?: string;
};

/** Snapshot at module eval (host sets the global only during import). */
const PLUGIN_ENTRY_AT_LOAD: string = (() => {
  const g = globalThis as MolvisPluginGlobals;
  return typeof g.__MOLVIS_PLUGIN_ENTRY__ === "string"
    ? g.__MOLVIS_PLUGIN_ENTRY__
    : "";
})();

/** Directory containing plugin.js + flat kernel assets. */
export function pluginBaseUrl(): string {
  if (PLUGIN_ENTRY_AT_LOAD.length > 0) {
    const i = PLUGIN_ENTRY_AT_LOAD.lastIndexOf("/");
    return i >= 0 ? PLUGIN_ENTRY_AT_LOAD.slice(0, i + 1) : PLUGIN_ENTRY_AT_LOAD;
  }
  if (typeof document !== "undefined") {
    const scripts = document.querySelectorAll("script[src]");
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = (scripts[i] as HTMLScriptElement).src;
      if (src.includes("plugin.js")) {
        return src.slice(0, src.lastIndexOf("/") + 1);
      }
    }
  }
  return "./";
}

/** Flat sibling of plugin.js. */
export function pluginAssetUrl(name: string): string {
  return `${pluginBaseUrl()}${name.replace(/^\.\//, "")}`;
}

/**
 * `new Worker(cross-origin URL)` is blocked by the browser.
 * Same-origin: use the URL. Cross-origin: CORS fetch → blob: (module workers
 * from jupyterlite are self-contained bundles).
 */
export async function sameOriginWorkerUrl(remoteUrl: string): Promise<string> {
  let pageOrigin = "";
  try {
    pageOrigin = globalThis.location?.origin ?? "";
  } catch {
    /* non-browser */
  }
  try {
    if (pageOrigin && new URL(remoteUrl).origin === pageOrigin) {
      return remoteUrl;
    }
  } catch {
    /* relative */
  }

  const res = await fetch(remoteUrl, { mode: "cors", credentials: "omit" });
  if (!res.ok) {
    throw new Error(
      `Kernel worker missing at ${remoteUrl} (HTTP ${res.status}). ` +
        "Build must emit workers next to plugin.js (rsbuild output.copy).",
    );
  }
  const source = await res.text();
  return URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
}

export const PIPLITE_WHEEL = "piplite-0.8.2-py3-none-any.whl";
export const PIPLITE_INDEX = "all.json";

