/**
 * Third-party runtime versions, pinned in one place.
 *
 * These packages are fetched from a CDN at runtime, so they appear in no
 * `package.json`, no lockfile, and no dependency scanner. That makes an
 * inline version literal invisible to every tool that would normally catch a
 * stale pin — and the xterm version was already written twice (JS module and
 * stylesheet), where bumping one and forgetting the other skews the terminal
 * silently.
 */

export const PYODIDE_VERSION = "v314.0.3";
export const XTERM_VERSION = "5.5.0";
export const XTERM_FIT_VERSION = "0.10.0";
export const MONACO_VERSION = "0.52.2";
export const SHIKI_VERSION = "3.12.2";

const JSDELIVR_NPM = "https://cdn.jsdelivr.net/npm";

export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;
export const XTERM_ESM_URL = `${JSDELIVR_NPM}/@xterm/xterm@${XTERM_VERSION}/+esm`;
export const XTERM_CSS_URL = `${JSDELIVR_NPM}/@xterm/xterm@${XTERM_VERSION}/css/xterm.min.css`;
export const XTERM_FIT_ESM_URL = `${JSDELIVR_NPM}/@xterm/addon-fit@${XTERM_FIT_VERSION}/+esm`;
export const MONACO_ESM_URL = `${JSDELIVR_NPM}/monaco-editor@${MONACO_VERSION}/+esm`;
export const SHIKI_ESM_URL = `${JSDELIVR_NPM}/shiki@${SHIKI_VERSION}/+esm`;

/**
 * PyPI packages installed into the Pyodide runtime via micropip.
 *
 * Pinned deliberately: unpinned installs mean an upstream release silently
 * changes the runtime under an already-published plugin bundle. `molrs` in
 * particular has had breaking changes within 0.0.x patch releases.
 */
export const MICROPIP_REQUIREMENTS = [
  "molcrafts-molrs",
  "molcrafts-mollog",
  "molcrafts-molcfg",
] as const;
