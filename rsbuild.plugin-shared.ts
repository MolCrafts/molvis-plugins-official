/**
 * Shared MolVis page-plugin rsbuild options (React 19 + automatic JSX).
 *
 * - Single ESM `dist/plugin.js`
 * - Peer packages externalized for host singleton injection
 * - `@rsbuild/plugin-react` = modern JSX transform (no free `React.createElement`)
 */
import type { RsbuildConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginExternals } from "./plugin-externals";

export { pluginExternals };

export function createPluginRsbuildConfig(
  options: {
    injectStyles?: boolean;
    extraExternals?: Record<string, string>;
  } = {},
): RsbuildConfig {
  const { injectStyles = false, extraExternals = {} } = options;
  // Faster watch rebuilds for `npm run dev` / `npm run serve`.
  const isDev = process.env.MOLVIS_PLUGIN_DEV === "1";
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
    },
    html: {
      template: false as unknown as string,
    },
    tools: {
      htmlPlugin: false,
      rspack: {
        output: {
          library: { type: "module" },
          chunkFormat: "module",
          module: true,
        },
        experiments: {
          outputModule: true,
        },
        externalsType: "module",
        externals: {
          ...pluginExternals,
          ...extraExternals,
        },
        module: {
          rules: [
            {
              test: /\.whl$/,
              type: "asset/resource",
            },
          ],
        },
      },
    },
    performance: {
      chunkSplit: {
        strategy: "all-in-one",
      },
    },
  };
}
