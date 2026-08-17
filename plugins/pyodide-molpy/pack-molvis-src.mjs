#!/usr/bin/env node
/**
 * Write molvis-src-manifest.json — the .py files in the sibling molvis
 * package. The kernel fetches those URLs into sys.path (editable install).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

function findMolvisPackage(start) {
  const link = path.join(repoRoot, "molvis-src");
  if (fs.existsSync(path.join(link, "__init__.py"))) return link;
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const cand = path.resolve(dir, "..", "molvis", "python", "src", "molvis");
    if (fs.existsSync(path.join(cand, "__init__.py"))) return cand;
    dir = path.dirname(dir);
  }
  return null;
}

function walkPy(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of fs.readdirSync(dir)) {
      if (name === "__pycache__" || name === "dist") continue;
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (name.endsWith(".py")) out.push(path.relative(root, full));
    }
  }
  return out.sort();
}

const pkg = findMolvisPackage(here);
if (!pkg) {
  console.log("no sibling molvis source — kernel will use molcrafts-molvis==0.2.0 from PyPI");
  process.exit(0);
}

const files = walkPy(pkg);
if (!files.includes("__init__.py")) {
  console.error("molvis package has no __init__.py at", pkg);
  process.exit(1);
}

const manifest = path.join(repoRoot, "molvis-src-manifest.json");
fs.writeFileSync(manifest, `${JSON.stringify(files, null, 2)}\n`);
console.log(`wrote ${files.length} paths → ${path.relative(repoRoot, manifest)}`);
