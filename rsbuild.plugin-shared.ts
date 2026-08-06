/**
 * Shared rsbuild for MolVis page plugins.
 *
 * - ESM `dist/plugin.js` (all-in-one)
 * - Host peers externalized (`@molcrafts/molvis-plugin`)
 * - Optional **kernel runtime** assets via `output.copy` (workers + piplite
 *   wheels from `@jupyterlite/pyodide-kernel`) — no post-build shell scripts
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RsbuildConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { rspack } from "@rspack/core";
import { pluginExternals } from "@molcrafts/molvis-plugin";

export { pluginExternals };

const collectionRoot = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export type PluginRsbuildOptions = {
  injectStyles?: boolean;
  extraExternals?: Record<string, string>;
  /**
   * Emit JupyterLite kernel workers + piplite wheels next to plugin.js.
   * Required for any package that runs HostKernel (pyodide-molpy or the
   * collection that embeds it).
   */
  kernelRuntime?: boolean;
};

/** Patterns for rsbuild `output.copy` — flat names at dist root. */
export function jupyterLiteRuntimeCopyPatterns(): Array<{
  from: string;
  to: string;
}> {
  const pkgRoot = dirname(
    require.resolve("@jupyterlite/pyodide-kernel/package.json"),
  );
  const patterns: Array<{ from: string; to: string }> = [];

  for (const name of ["comlink.worker.js", "coincident.worker.js"]) {
    const from = join(pkgRoot, "lib", name);
    if (fs.existsSync(from)) {
      patterns.push({ from, to: name });
    }
    const map = `${from}.map`;
    if (fs.existsSync(map)) {
      patterns.push({ from: map, to: `${name}.map` });
    }
  }

  const pypiDir = join(pkgRoot, "pypi");
  if (fs.existsSync(pypiDir)) {
    for (const name of fs.readdirSync(pypiDir)) {
      if (!name.endsWith(".whl") && name !== "all.json") continue;
      patterns.push({ from: join(pypiDir, name), to: name });
    }
  }

  return patterns;
}

/**
 * Pin a package to one specific build.
 *
 * A package that cannot be located is **omitted**, never mapped to `false`:
 * rspack reads `alias: false` as "ignore this module" and stubs it out. That
 * silently removed `tailwind-merge` — and with it the class merging behind
 * `cn()` — from a bundle that still built and still passed every gate.
 */
function pinnedEntries(
  entries: ReadonlyArray<readonly [pkg: string, rel: string]>,
): Record<string, string> {
  const alias: Record<string, string> = {};
  for (const [pkg, rel] of entries) {
    let root: string;
    try {
      root = dirname(require.resolve(`${pkg}/package.json`));
    } catch {
      // `exports` can hide package.json; fall back to the main entry's package.
      try {
        let dir = dirname(require.resolve(pkg));
        while (!fs.existsSync(join(dir, "package.json"))) {
          const up = dirname(dir);
          if (up === dir) throw new Error(`no package root for ${pkg}`);
          dir = up;
        }
        root = dir;
      } catch {
        continue;
      }
    }
    const file = join(root, rel);
    if (fs.existsSync(file)) alias[`${pkg}$`] = file;
  }
  return alias;
}

export function createPluginRsbuildConfig(
  options: PluginRsbuildOptions = {},
): RsbuildConfig {
  const {
    injectStyles = false,
    extraExternals = {},
    kernelRuntime = false,
  } = options;
  const isDev = process.env.MOLVIS_PLUGIN_DEV === "1";

  const pypiStub = resolve(
    collectionRoot,
    "plugins/pyodide-molpy/src/kernel/pypi_urls_stub.js",
  );

  /**
   * UI libraries shared with `@molcrafts/molvis-plugin`.
   *
   * The SDK is consumed through `npm link` until it is published, so its
   * `dist/` resolves these from the *molvis* checkout while this repo's own
   * imports resolve from here — Rsdoctor measured two copies of
   * `lucide-react` (229 kB + 227 kB) in one bundle. Two copies of a radix
   * package would be worse than bloat: portals and context stop matching.
   *
   * The SDK declares them as peers; this pins every consumer to one copy.
   */
  const SHARED_UI_PACKAGES = [
    "@radix-ui/react-checkbox",
    "@radix-ui/react-select",
    "@radix-ui/react-slot",
    "class-variance-authority",
    "clsx",
    "lucide-react",
    "tailwind-merge",
  ];

  return {
    plugins: [
      pluginReact({
        swcReactOptions: {
          runtime: "automatic",
          importSource: "react",
        },
      }),
    ],
    source: {
      entry: {
        index: "./src/index.tsx",
      },
      alias: {
        "@": resolve(collectionRoot, "src"),
      },
    },
    resolve: {
      dedupe: SHARED_UI_PACKAGES,
      /**
       * Prefer every package's ESM build; CJS cannot be tree-shaken.
       *
       * `@lumino/*` predate `exports` and advertise ESM only through
       * `module`, so without this `@lumino/coreutils` lands as CommonJS.
       */
      mainFields: ["module", "browser", "main"],
      conditionNames: ["import", "module", "browser", "default", "require"],
      /**
       * Two packages `mainFields` cannot reach, pinned by path:
       *
       * - `json5` must stay CommonJS. Its ESM build exports only `default`
       *   while `@jupyterlite/services` imports the named `parse`, so
       *   preferring ESM fails the build (`ESModulesLinkingError`).
       * - `tailwind-merge` must be ESM. `dedupe` above redirects it to a
       *   directory, which bypasses its `exports` map (and so
       *   `conditionNames`); with no `module` field it falls back to the
       *   CommonJS `main`.
       */
      alias: pinnedEntries([
        ["json5", "lib/index.js"],
        ["tailwind-merge", "dist/bundle-mjs.mjs"],
      ]),
    },
    output: {
      target: "web",
      distPath: {
        root: "dist",
        js: "./",
      },
      filename: {
        js: "plugin.js",
      },
      minify: !isDev,
      sourceMap: isDev ? "cheap-module-source-map" : false,
      cleanDistPath: !isDev,
      injectStyles,
      ...(kernelRuntime
        ? { copy: jupyterLiteRuntimeCopyPatterns() }
        : {}),
    },
    html: {
      template: false as unknown as string,
    },
    tools: {
      htmlPlugin: false,
      rspack: (config) => {
        config.output = {
          ...config.output,
          library: { type: "module" },
          chunkFormat: "module",
          module: true,
        };
        config.experiments = {
          ...config.experiments,
          outputModule: true,
        };
        config.externalsType = "module";
        config.externals = {
          ...(typeof config.externals === "object" &&
          !Array.isArray(config.externals)
            ? config.externals
            : {}),
          ...pluginExternals,
          ...extraExternals,
        };
        if (kernelRuntime) {
          // Relative import inside kernel.js → absolute path; replace module.
          config.plugins = config.plugins ?? [];
          config.plugins.push(
            new rspack.NormalModuleReplacementPlugin(
              /[\\/]@jupyterlite[\\/]pyodide-kernel[\\/]lib[\\/]_pypi\.js$/,
              pypiStub,
            ),
          );
        }
      },
    },
    performance: {
      chunkSplit: {
        strategy: "all-in-one",
      },
    },
  };
}
