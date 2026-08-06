import { defineConfig } from "@rsbuild/core";
import { createPluginRsbuildConfig } from "../../rsbuild.plugin-shared";

/** Standalone pyodide-molpy package — needs kernel workers + piplite next to plugin.js. */
export default defineConfig(
  createPluginRsbuildConfig({
    injectStyles: true,
    kernelRuntime: true,
  }),
);
