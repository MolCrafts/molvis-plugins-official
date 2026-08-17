/**
 * Official collection package — embeds every child (including HostKernel).
 * Same kernel runtime assets as pyodide-molpy (flat next to dist/plugin.js).
 */
import { defineConfig } from "@rsbuild/core";
import { createPluginRsbuildConfig } from "./rsbuild.plugin-shared";

export default defineConfig(
  createPluginRsbuildConfig({
    injectStyles: true,
    kernelRuntime: true,
  }),
);
