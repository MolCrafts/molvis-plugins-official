#!/usr/bin/env node
/**
 * Package `dist/` trees into `release-assets/` for GitHub Releases.
 *
 * Expects `npm run build` already produced:
 *   dist/plugin.js
 *   dist/*.worker.js, all.json, *.whl   (when kernelRuntime is on)
 *
 * Rewrites manifest entry → `plugin.js` (flat Release layout).
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

function copyDist(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  for (const name of fs.readdirSync(srcDir)) {
    if (
      name.endsWith(".map") ||
      name.endsWith(".LICENSE.txt") ||
      name === ".DS_Store" ||
      name === "static"
    ) {
      // Skip sourcemaps / webpack junk; keep flat runtime files only.
      if (name === "static") continue;
      if (name.endsWith(".map") || name.endsWith(".LICENSE.txt")) continue;
    }
    const s = path.join(srcDir, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) {
      // Only top-level flat assets matter for the host.
      continue;
    }
    copyFile(s, path.join(destDir, name));
  }
}

function writeReleaseManifest(srcManifestPath, destPath) {
  const man = JSON.parse(fs.readFileSync(srcManifestPath, "utf8"));
  man.entry = "plugin.js";
  fs.writeFileSync(destPath, `${JSON.stringify(man, null, 2)}\n`);
}

rmrf(outDir);
fs.mkdirSync(outDir, { recursive: true });

// Collection
const collectionDist = path.join(root, "dist");
if (fs.existsSync(path.join(collectionDist, "plugin.js"))) {
  const dest = path.join(outDir, "meta");
  fs.mkdirSync(dest, { recursive: true });
  copyDist(collectionDist, dest);
  writeReleaseManifest(
    path.join(root, "molvis.plugin.json"),
    path.join(dest, "molvis.plugin.json"),
  );
  console.log(`[prepare-release] collection → release-assets/meta/`);
}

// Children
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
  copyDist(dist, dest);
  writeReleaseManifest(man, path.join(dest, "molvis.plugin.json"));
  console.log(`[prepare-release] ${name} → release-assets/${name}/`);
}

console.log(`[prepare-release] done → ${outDir}`);
