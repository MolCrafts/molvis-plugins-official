#!/usr/bin/env node
/**
 * Place a molcrafts-molvis py3-none-any wheel next to the plugin for
 * Release fallback. Prefer the published PyPI 0.2.0; if a sibling
 * molvis/python exists, build from that instead (MOLVIS_SKIP_UI_BUILD=1).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function findMolvisPython(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const cand = path.resolve(dir, "..", "molvis", "python");
    if (fs.existsSync(path.join(cand, "pyproject.toml"))) return cand;
    dir = path.dirname(dir);
  }
  return null;
}

const out = path.join(here, "runtime-wheels");
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) {
  if (f.endsWith(".whl")) fs.unlinkSync(path.join(out, f));
}

const destArg = JSON.stringify(out);
const molvis = findMolvisPython(here);
if (molvis) {
  const env = { ...process.env, MOLVIS_SKIP_UI_BUILD: "1" };
  const attempts = [
    `uv run --extra dev python -m build --wheel -o ${destArg}`,
    `python3 -m build --wheel -o ${destArg}`,
    `python3 -m pip install -q build && python3 -m build --wheel -o ${destArg}`,
  ];
  let lastErr = null;
  for (const cmd of attempts) {
    try {
      execSync(cmd, { cwd: molvis, env, stdio: "inherit", shell: true });
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) {
    console.error("failed to build molvis wheel from", molvis);
    process.exit(1);
  }
} else {
  try {
    execSync(
      `python3 -m pip download molcrafts-molvis==0.2.0 --only-binary=:all: --no-deps -d ${destArg}`,
      { stdio: "inherit", shell: true },
    );
  } catch {
    console.log(
      "no PyPI wheel and no sibling molvis — kernel will micropip molcrafts-molvis==0.2.0",
    );
    process.exit(0);
  }
}

const whl = fs
  .readdirSync(out)
  .filter((f) => f.startsWith("molcrafts_molvis") && f.endsWith(".whl"));
if (whl.length !== 1) {
  console.error("expected one molvis wheel, got", whl);
  process.exit(1);
}

const cdn = path.join(here, "src/cdn.ts");
const cdnText = fs.readFileSync(cdn, "utf8");
const next = cdnText.replace(
  /export const MOLVIS_WHEEL = "[^"]+";/,
  `export const MOLVIS_WHEEL = ${JSON.stringify(whl[0])};`,
);
if (next === cdnText && !cdnText.includes(whl[0])) {
  console.error("cdn.ts has no MOLVIS_WHEEL assignment to rewrite");
  process.exit(1);
}
fs.writeFileSync(cdn, next);

console.log("packed", whl[0], "from", molvis ?? "PyPI");
