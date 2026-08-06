/**
 * Shared rsbuild for MolVis page plugins.
 *
 * - ESM `dist/plugin.js` (all-in-one)
 * - Host peers externalized (`plugin-externals.ts`)
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
import { pluginExternals } from "./plugin-externals";

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
