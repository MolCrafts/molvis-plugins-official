import type { Configuration } from "@rspack/core";

/**
 * Shared low-level Rspack policy used by both Rsbuild and Rslib.
 * Keep browser output deterministic and suppress bundle-size warnings for the
 * self-contained MolVis plugin.
 */
export function applyAlchemistRspackDefaults(
  config: Configuration,
): void {
  config.optimization = {
    ...config.optimization,
    chunkIds: "deterministic",
    moduleIds: "deterministic",
    realContentHash: true,
  };
  config.performance = {
    ...config.performance,
    hints: false,
  };
}

