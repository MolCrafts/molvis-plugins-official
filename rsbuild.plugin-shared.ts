/**
 * Shared MolVis page-plugin rsbuild options (React 19 + automatic JSX).
 *
 * - Single ESM `dist/plugin.js`
 * - Peer packages externalized for host singleton injection
 * - `@rsbuild/plugin-react` = modern JSX transform (no free `React.createElement`)
 */
import type { RsbuildConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export const pluginExternals = {
  react: "react",
  "react-dom": "react-dom",
  "react-dom/client": "react-dom/client",
  "react/jsx-runtime": "react/jsx-runtime",
  "react/jsx-dev-runtime": "react/jsx-dev-runtime",
  "@molcrafts/molvis-core": "@molcrafts/molvis-core",
  "@molvis/core": "@molvis/core",
  "@molcrafts/molrs": "@molcrafts/molrs",
  "@molcrafts/molplot": "@molcrafts/molplot",
  "@molvis/stage": "@molvis/stage",
  "@molcrafts/molvis-stage": "@molcrafts/molvis-stage",
} as const;

export function createPluginRsbuildConfig(
  options: {
    injectStyles?: boolean;
    extraExternals?: Record<string, string>;
  } = {},
): RsbuildConfig {
  const { injectStyles = false, extraExternals = {} } = options;
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
      minify: true,
      sourceMap: false,
      cleanDistPath: true,
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
      },
    },
    performance: {
      chunkSplit: {
        strategy: "all-in-one",
      },
    },
  };
}
