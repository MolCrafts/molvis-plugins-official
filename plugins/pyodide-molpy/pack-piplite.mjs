#!/usr/bin/env node
/**
 * Write the piplite wheel filename from the installed
 * `@jupyterlite/pyodide-kernel` (always whatever `latest` resolved to).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.dirname(
  require.resolve("@jupyterlite/pyodide-kernel/package.json"),
);
const pypi = path.join(pkgRoot, "pypi");
const wheels = fs
  .readdirSync(pypi)
  .filter((n) => n.startsWith("piplite-") && n.endsWith(".whl"))
  .sort();
if (wheels.length !== 1) {
  console.error("expected one piplite wheel in", pypi, "got", wheels);
  process.exit(1);
}

const out = path.join(here, "src/kernel/generated_piplite.ts");
fs.writeFileSync(
  out,
  `/* generated from @jupyterlite/pyodide-kernel pypi/ by pack:piplite */\n` +
    `export const PIPLITE_WHEEL = ${JSON.stringify(wheels[0])};\n`,
);
console.log("piplite", wheels[0], "from", pkgRoot);
