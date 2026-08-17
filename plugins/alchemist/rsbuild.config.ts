import { defineConfig } from "@rsbuild/core";
import { applyAlchemistRspackDefaults } from "./rspack.shared";

export default defineConfig({
  source: {
    entry: {
      index: "./src/site.ts",
    },
  },
  html: {
    title: "Alchemist",
    meta: {
      charset: { charset: "utf-8" },
      viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
      description:
        "Merge eleven elements in atomic-number order and reach gold.",
      "theme-color": "#dfe6e4",
    },
  },
  output: {
    target: "web",
    distPath: {
      root: "dist",
    },
    cleanDistPath: true,
    assetPrefix: "./",
    filenameHash: true,
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
