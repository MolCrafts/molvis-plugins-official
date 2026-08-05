#!/usr/bin/env node
/**
 * Flatten built plugin packages into `release-assets/` for GitHub Releases.
 *
 * Host resolve (`owner/repo@vX.Y.Z`) loads:
 *   https://github.com/.../releases/download/vX.Y.Z/molvis.plugin.json
 *   https://github.com/.../releases/download/vX.Y.Z/plugin.js
 *   (+ sibling workers / pypi files)
 *
 * Manifest `entry` becomes `plugin.js` (not `dist/plugin.js`).
 *
 * Usage (after `npm run build`):
 *   node scripts/prepare-release-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "release-assets");

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirFlatOrTree(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  for (const name of fs.readdirSync(srcDir)) {
    const s = path.join(srcDir, name);
    const d = path.join(destDir, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) {
      copyDirFlatOrTree(s, d);
    } else if (
      name.endsWith(".map") ||
      name.endsWith(".LICENSE.txt") ||
      name === ".DS_Store"
    ) {
      continue;
    } else {
      copyFile(s, d);
    }
  }
}

function writeReleaseManifest(srcManifestPath, destPath) {
  const man = JSON.parse(fs.readFileSync(srcManifestPath, "utf8"));
  man.entry = "plugin.js";
  fs.writeFileSync(destPath, `${JSON.stringify(man, null, 2)}\n`);
}

/** GitHub Release assets are flat — lift any nested files to dest root. */
function flattenInto(destDir) {
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
        fs.rmdirSync(full);
        continue;
      }
      if (dir === destDir) continue;
      const target = path.join(destDir, name);
      if (full !== target) {
        if (fs.existsSync(target)) fs.rmSync(target);
        fs.renameSync(full, target);
      }
    }
  };
  walk(destDir);
}

rmrf(outDir);
fs.mkdirSync(outDir, { recursive: true });

// Meta collection (root dist + workers from pyodide if present)
const metaDist = path.join(root, "dist");
if (fs.existsSync(path.join(metaDist, "plugin.js"))) {
  const metaOut = path.join(outDir, "meta");
  fs.mkdirSync(metaOut, { recursive: true });
  copyDirFlatOrTree(metaDist, metaOut);
  // Prefer root-level workers from pyodide build if meta copied hashed static only
  const pyWorkers = path.join(root, "plugins/pyodide-molpy/dist");
  for (const w of ["comlink.worker.js", "coincident.worker.js"]) {
    const src = path.join(pyWorkers, w);
    if (fs.existsSync(src) && !fs.existsSync(path.join(metaOut, w))) {
      copyFile(src, path.join(metaOut, w));
    }
  }
  const pypi = path.join(pyWorkers, "pypi");
  if (fs.existsSync(pypi)) {
    copyDirFlatOrTree(pypi, path.join(metaOut, "pypi"));
  }
  writeReleaseManifest(
    path.join(root, "molvis.plugin.json"),
    path.join(metaOut, "molvis.plugin.json"),
  );
  flattenInto(metaOut);
  console.log(`[prepare-release] meta → release-assets/meta/`);
}

// Per-plugin packages
const pluginsDir = path.join(root, "plugins");
for (const name of fs.readdirSync(pluginsDir)) {
  const pkg = path.join(pluginsDir, name);
  const dist = path.join(pkg, "dist");
  const man = path.join(pkg, "molvis.plugin.json");
  if (!fs.existsSync(path.join(dist, "plugin.js")) || !fs.existsSync(man)) {
    continue;
  }
  const dest = path.join(outDir, name);
  fs.mkdirSync(dest, { recursive: true });
  copyDirFlatOrTree(dist, dest);
  writeReleaseManifest(man, path.join(dest, "molvis.plugin.json"));
  flattenInto(dest);
  console.log(`[prepare-release] ${name} → release-assets/${name}/`);
}

console.log(`[prepare-release] done → ${outDir}`);
