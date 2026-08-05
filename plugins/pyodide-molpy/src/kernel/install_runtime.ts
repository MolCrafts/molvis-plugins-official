import { MICROPIP_REQUIREMENTS } from "../cdn";
/**
 * Pyodide stack for the pyodide-molpy plugin.
 *
 * Install order (hard fail, no stubs):
 *   1. numpy + micropip          — Pyodide CDN
 *   2. molcrafts-molrs           — PyPI emscripten wheel (binary)
 *   3. molcrafts-mollog/molcfg   — PyPI pure wheels (molpy deps)
 *   4. molpy + molvis            — packed into the plugin bundle
 *                                  (`local_py_sources.ts`, committed) and
 *                                  written onto the Pyodide FS
 *
 * Not used in this mode: micropip install of molpy / molvis from PyPI.
 * Refresh the pack with `npm run pack:local-py` when sibling trees change.
 */

import { LOCAL_PY_ROOT, LOCAL_PY_SOURCES } from "./local_py_sources";

type PyodideFs = {
  writeFile: (path: string, data: string | Uint8Array) => void;
  mkdirTree?: (path: string) => void;
  mkdir?: (path: string) => void;
  analyzePath?: (path: string) => { exists: boolean };
};

export type PyodideLike = {
  FS: PyodideFs;
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (name: string | string[]) => Promise<void>;
  setInterruptBuffer?: (buffer: Uint8Array) => void;
};

function ensureDir(fs: PyodideFs, dir: string): void {
  if (fs.mkdirTree) {
    try {
      fs.mkdirTree(dir);
      return;
    } catch {
      /* fall through */
    }
  }
  const parts = dir.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur += `/${p}`;
    try {
      if (fs.analyzePath && fs.analyzePath(cur).exists) continue;
      fs.mkdir?.(cur);
    } catch {
      /* exists */
    }
  }
}

function writeLocalPackages(pyodide: PyodideLike): void {
  const n = Object.keys(LOCAL_PY_SOURCES).length;
  if (n === 0) {
    throw new Error(
      "LOCAL_PY_SOURCES is empty — run `npm run pack:local-py` (or prebuild) first",
    );
  }
  const root = LOCAL_PY_ROOT;
  ensureDir(pyodide.FS, root);
  for (const [rel, content] of Object.entries(LOCAL_PY_SOURCES)) {
    const full = `${root}/${rel}`;
    const dir = full.slice(0, full.lastIndexOf("/"));
    ensureDir(pyodide.FS, dir);
    pyodide.FS.writeFile(full, content);
  }
}

/**
 * Local-dev install: molrs/mollog/molcfg from PyPI, molpy+molvis from monorepo pack.
 */
export async function installRuntimePackages(
  pyodide: PyodideLike,
): Promise<void> {
  await pyodide.loadPackage(["numpy", "micropip"]);

  // Binary / published ecosystem deps only.
  await pyodide.runPythonAsync(`
import micropip

await micropip.install(
    ${JSON.stringify(MICROPIP_REQUIREMENTS)},
    keep_going=False,
)

import molrs  # noqa: F401
`);

  writeLocalPackages(pyodide);

  await pyodide.runPythonAsync(`
import sys
_root = ${JSON.stringify(LOCAL_PY_ROOT)}
if _root not in sys.path:
    sys.path.insert(0, _root)
# Prefer local pack over any earlier install.
for _k in list(sys.modules):
    if _k in ("molpy", "molvis") or _k.startswith("molpy.") or _k.startswith("molvis."):
        del sys.modules[_k]
import molpy as mp  # noqa: F401 — monorepo pack
import molvis as mv  # noqa: F401 — monorepo pack
print("[pyodide-molpy] local-dev: molrs + monorepo molpy + monorepo molvis")
`);
}

/** @deprecated use {@link installRuntimePackages} */
export const installMolvisPackage = installRuntimePackages;
