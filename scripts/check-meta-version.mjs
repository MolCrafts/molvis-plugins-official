#!/usr/bin/env node
/**
 * Enforce meta collection version scheme:
 *
 *   major  — plugin system / host contract generation
 *   minor  — number of child plugins under plugins/*
 *   patch  — fixes with the same plugin set
 *
 * Also checks that OFFICIAL_PLUGINS in src/version.ts matches plugins/*
 * directory names (kinds + count).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginsDir = join(repoRoot, "plugins");

const dirs = readdirSync(pluginsDir)
  .filter((name) => {
    try {
      return statSync(join(pluginsDir, name)).isDirectory();
    } catch {
      return false;
    }
  })
  .filter((name) => {
    try {
      statSync(join(pluginsDir, name, "package.json"));
      return true;
    } catch {
      return false;
    }
  })
  .sort();

const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const m = String(pkg.version).match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
if (!m) {
  console.error(`root package.json version ${JSON.stringify(pkg.version)} is not semver X.Y.Z`);
  process.exit(1);
}
const major = Number(m[1]);
const minor = Number(m[2]);
const patch = Number(m[3]);
const count = dirs.length;

let failed = false;

if (minor !== count) {
  console.error(
    `meta version ${pkg.version}: minor must equal plugin count (${count}), got minor=${minor}`,
  );
  console.error(`  plugins: ${dirs.join(", ")}`);
  failed = true;
}

const versionTs = readFileSync(join(repoRoot, "src/version.ts"), "utf8");
const listMatch = versionTs.match(
  /export const OFFICIAL_PLUGINS\s*=\s*\[([\s\S]*?)\]\s*as const/,
);
if (!listMatch) {
  console.error("src/version.ts: could not find OFFICIAL_PLUGINS array");
  failed = true;
} else {
  const listed = [...listMatch[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
  const a = listed.join("\n");
  const b = dirs.join("\n");
  if (a !== b) {
    console.error("OFFICIAL_PLUGINS does not match plugins/*/ packages:");
    console.error(`  version.ts: ${listed.join(", ") || "(empty)"}`);
    console.error(`  disk:       ${dirs.join(", ") || "(empty)"}`);
    failed = true;
  }
  if (listed.length !== count) {
    console.error(
      `OFFICIAL_PLUGINS length ${listed.length} != plugin count ${count}`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);

console.log(
  `meta version ${pkg.version} ok (system major=${major}, plugins minor=${minor}=${count}, patch=${patch})`,
);
console.log(`  kinds: ${dirs.join(", ")}`);
