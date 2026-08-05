#!/usr/bin/env node
/**
 * Keep each package's `molvis.plugin.json` version equal to that package's
 * `package.json` version — **per package only**.
 *
 * Child plugin versions are independent. The meta package uses its own
 * scheme: major=plugin system, minor=plugin count, patch=fixes (see
 * `check-meta-version.mjs` and `src/version.ts`). *
 * Run with `--check` in CI to fail instead of rewriting.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const manifests = [
  join(repoRoot, "molvis.plugin.json"),
  ...globSync("plugins/*/molvis.plugin.json", { cwd: repoRoot }).map((p) =>
    join(repoRoot, p),
  ),
];

let drifted = 0;
for (const manifestPath of manifests) {
  const pkgPath = join(dirname(manifestPath), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version === pkg.version) continue;

  drifted += 1;
  const where = relative(repoRoot, manifestPath);
  if (checkOnly) {
    console.error(
      `${where}: version ${manifest.version} != package.json ${pkg.version}`,
    );
    continue;
  }
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ ...manifest, version: pkg.version }, null, 2)}\n`,
  );
  console.log(`${where}: ${manifest.version} -> ${pkg.version}`);
}

if (drifted > 0 && checkOnly) {
  console.error(
    "\nManifest versions are stale. Run: node scripts/sync-manifest-versions.mjs",
  );
  process.exit(1);
}
if (drifted === 0) console.log("manifest versions in sync (per package)");
