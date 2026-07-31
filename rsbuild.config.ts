/**
 * Meta-plugin: activates all official plugins under one host pluginId.
 */
import { defineConfig } from "@rsbuild/core";
import { createPluginRsbuildConfig } from "./rsbuild.plugin-shared";

export default defineConfig(
  createPluginRsbuildConfig({
    injectStyles: true,
  }),
);
