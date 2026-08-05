#!/usr/bin/env node
/**
 * Hot-rebuild plugin dist/ and serve over HTTP (CORS + no-cache).
 *
 * This is the local-dev entry — not a one-shot `build && serve`.
 *
 * Usage:
 *   node scripts/dev-serve.mjs [meta|pyodide|lammps|alchemist|carbon-tube|all]
 *
 * Ports (default):
 *   meta / all → 4173  (repo root; dist/plugin.js + molvis.plugin.json)
 *   pyodide    → 4174
 *   lammps     → 4175
 *   alchemist  → 4176
 *   carbon-tube → 4177
 *
 * Env:
 *   PORT=…              override listen port
 *   MOLVIS_PLUGIN_DEV=1 set by this script for faster rsbuild watch
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const TARGETS = {
  meta: {
    cwd: root,
    port: 4173,
    serveRoot: root,
    pack: true, // meta embeds pyodide → keep local py pack fresh
    watchPy: true,
    label: "meta (all official plugins)",
  },
  all: null, // alias → meta
  pyodide: {
    cwd: path.join(root, "plugins/pyodide-molpy"),
    port: 4174,
    serveRoot: path.join(root, "plugins/pyodide-molpy"),
    pack: true,
    watchPy: true,
    label: "pyodide-molpy",
  },
  lammps: {
    cwd: path.join(root, "plugins/lammps-input-generator"),
    port: 4175,
    serveRoot: path.join(root, "plugins/lammps-input-generator"),
    pack: false,
    watchPy: false,
    label: "lammps-input-generator",
  },
  alchemist: {
    cwd: path.join(root, "plugins/alchemist"),
    port: 4176,
    serveRoot: path.join(root, "plugins/alchemist"),
    pack: false,
    watchPy: false,
    label: "alchemist",
  },
  "carbon-tube": {
    cwd: path.join(root, "plugins/carbon-tube-builder"),
    port: 4177,
    serveRoot: path.join(root, "plugins/carbon-tube-builder"),
    pack: false,
    watchPy: false,
    label: "carbon-tube-builder",
  },
};

TARGETS.all = TARGETS.meta;

const name = (process.argv[2] || "meta").toLowerCase();
const target = TARGETS[name];
if (!target) {
  console.error(
    `Unknown target ${JSON.stringify(name)}. Use: meta | pyodide | lammps | alchemist | carbon-tube | all`,
  );
  process.exit(1);
}

const port = Number(process.env.PORT || target.port);
const children = [];

function log(...args) {
  console.log(`[dev:${name}]`, ...args);
}

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, MOLVIS_PLUGIN_DEV: "1" },
    ...opts,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      log(`${cmd} exited ${code}`);
    }
  });
  return child;
}

function packLocalPy() {
  const script = path.join(
    root,
    "plugins/pyodide-molpy/scripts/pack-local-py.mjs",
  );
  if (!fs.existsSync(script)) return;
  log("pack-local-py…");
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [script], {
      stdio: "inherit",
      cwd: path.join(root, "plugins/pyodide-molpy"),
    });
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`pack exited ${code}`)),
    );
  });
}

/** Minimal static server: CORS + no-store so plugin Reload always gets fresh JS. */
function startStaticServer(serveRoot, listenPort) {
  const mime = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".wasm": "application/wasm",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
  };

  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://127.0.0.1:${listenPort}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    if (rel === "/" || rel === "") {
      // Prefer manifest for directory install
      if (fs.existsSync(path.join(serveRoot, "molvis.plugin.json"))) {
        rel = "/molvis.plugin.json";
      } else {
        rel = "/dist/plugin.js";
      }
    }

    const filePath = path.normalize(path.join(serveRoot, rel));
    if (!filePath.startsWith(serveRoot)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end(`not found: ${rel}`);
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, {
        "Content-Type": mime[ext] || "application/octet-stream",
      });
      res.end(data);
    });
  });

  server.listen(listenPort, "127.0.0.1", () => {
    log(`serving ${path.relative(root, serveRoot) || "."} → http://127.0.0.1:${listenPort}/`);
    log(`MolVis Settings → Plugins → Add: http://127.0.0.1:${listenPort}/`);
    log("edit sources → auto rebuild; then host plugin Reload (no reinstall)");
  });

  return server;
}

function watchPythonPack() {
  if (!target.watchPy) return;

  const watchDirs = [
    path.resolve(root, "../molvis/python/src/molvis"),
    path.resolve(root, "../molpy/src/molpy"),
  ].filter((d) => fs.existsSync(d));

  let timer = null;
  let packing = false;
  let pending = false;

  const kick = () => {
    if (packing) {
      pending = true;
      return;
    }
    packing = true;
    packLocalPy()
      .catch((e) => log("pack failed:", e.message))
      .finally(() => {
        packing = false;
        if (pending) {
          pending = false;
          kick();
        }
      });
  };

  for (const dir of watchDirs) {
    try {
      fs.watch(dir, { recursive: true }, (_ev, file) => {
        if (file && !String(file).endsWith(".py") && !String(file).endsWith(".lark")) {
          return;
        }
        clearTimeout(timer);
        timer = setTimeout(kick, 300);
      });
      log("watching", path.relative(root, dir));
    } catch (e) {
      log("watch failed for", dir, e.message);
    }
  }
}

function shutdown() {
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  log(target.label, "— hot rebuild + no-cache serve");

  if (target.pack) {
    await packLocalPy();
  }

  startStaticServer(target.serveRoot, port);
  watchPythonPack();

  // rsbuild build --watch writes dist/plugin.js on change
  const rsbuildBin = path.join(root, "node_modules/@rsbuild/core/bin/rsbuild.js");
  const rsbuildArgs = fs.existsSync(rsbuildBin)
    ? [rsbuildBin, "build", "--watch"]
    : ["rsbuild", "build", "--watch"];

  const cmd = fs.existsSync(rsbuildBin) ? process.execPath : "npx";
  const args = fs.existsSync(rsbuildBin)
    ? rsbuildArgs
    : ["--yes", "rsbuild", "build", "--watch"];

  log("rsbuild build --watch in", path.relative(root, target.cwd) || ".");
  run(cmd, args, { cwd: target.cwd });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
