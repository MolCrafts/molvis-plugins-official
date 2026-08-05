import { defineConfig } from "@rslib/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginExternals } from "../../plugin-externals";
import { applyAlchemistRspackDefaults } from "./rspack.shared";

export default defineConfig({
  plugins: [
    pluginReact({
      swcReactOptions: { runtime: "automatic", importSource: "react" },
    }),
  ],
  source: {
    entry: {
      plugin: "./src/index.tsx",
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
    // React (and the other host packages) must stay external so the plugin
    // shares the page's singletons instead of bundling a second copy — the
    // same list every other plugin build uses.
    externals: pluginExternals,
  },
  tools: {
    rspack(config) {
      applyAlchemistRspackDefaults(config);
      config.externalsType = "module";
    },
  },
  performance: {
    chunkSplit: {
      strategy: "all-in-one",
    },
  },
});
