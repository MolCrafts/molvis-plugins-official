import { defineConfig } from "@rslib/core";
import { applyAlchemistRspackDefaults } from "./rspack.shared";

export default defineConfig({
  source: {
    entry: {
      plugin: "./src/index.ts",
    },
  },
  lib: [
    {
      id: "plugin",
      format: "esm",
      syntax: "es2022",
      bundle: true,
      autoExternal: false,
      autoExtension: false,
      dts: false,
    },
  ],
  output: {
    target: "web",
    distPath: {
      root: "dist",
    },
    cleanDistPath: false,
    filename: {
      js: "[name].js",
    },
    filenameHash: false,
    injectStyles: true,
    sourceMap: false,
    minify: true,
  },
  tools: {
    rspack(config) {
      applyAlchemistRspackDefaults(config);
    },
  },
  performance: {
    chunkSplit: {
      strategy: "all-in-one",
    },
  },
});
