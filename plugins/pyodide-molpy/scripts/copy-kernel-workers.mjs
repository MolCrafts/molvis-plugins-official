#!/usr/bin/env node
/**
 * Copy JupyterLite pyodide-kernel workers + piplite assets next to plugin.js
 * so runtime `new URL("./…", import.meta.url)` resolves after the single-file
 * rsbuild output.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, "..");
const dist = path.join(pluginRoot, "dist");

const pkgRoot = path.dirname(
  require.resolve("@jupyterlite/pyodide-kernel/package.json"),
);
const libDir = path.join(pkgRoot, "lib");
const pypiDir = path.join(pkgRoot, "pypi");

fs.mkdirSync(dist, { recursive: true });

for (const name of ["comlink.worker.js", "coincident.worker.js"]) {
  const src = path.join(libDir, name);
  const dest = path.join(dist, name);
  if (!fs.existsSync(src)) {
    console.warn(`[copy-kernel-workers] missing ${src}`);
    continue;
  }
  fs.copyFileSync(src, dest);
  const map = `${src}.map`;
  if (fs.existsSync(map)) fs.copyFileSync(map, `${dest}.map`);
  console.log(`[copy-kernel-workers] ${name} → dist/`);
}

// Flat names so GitHub Release assets + local HTTP share one layout.
for (const name of fs.readdirSync(pypiDir)) {
  if (!name.endsWith(".whl") && name !== "all.json") continue;
  fs.copyFileSync(path.join(pypiDir, name), path.join(dist, name));
  console.log(`[copy-kernel-workers] ${name} → dist/ (flat)`);
}