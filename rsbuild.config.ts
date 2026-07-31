import { defineConfig } from "@rsbuild/core";

/**
 * Meta-plugin library build — activates all official plugins under one
 * host pluginId. Child packages also ship their own dist/ for à-la-carte
 * install via subdirectory CDN URL.
 */
export default defineConfig({
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
    injectStyles: true,
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
        react: "react",
        "react-dom": "react-dom",
        "react-dom/client": "react-dom/client",
        "react/jsx-runtime": "react/jsx-runtime",
        "@molcrafts/molvis-core": "@molcrafts/molvis-core",
        "@molvis/core": "@molvis/core",
        "@molcrafts/molrs": "@molcrafts/molrs",
        "@molcrafts/molplot": "@molcrafts/molplot",
      },
    },
  },
  performance: {
    chunkSplit: {
      strategy: "all-in-one",
    },
  },
});
