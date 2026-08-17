import type { RstestConfig } from "@rstest/core";

/**
 * Node rstest externalizes node_modules, so `@molcrafts/molrs`'s
 * `import "./molrs_bg.wasm"` hits Node's loader and dies. Bundle the
 * published molvis/molrs chain and let rspack compile the WASM.
 */
export const molvisNodeRstest: Pick<RstestConfig, "output" | "tools"> = {
  output: {
    bundleDependencies: [/^@molcrafts\/mol(rs|vis-)/],
  },
  tools: {
    rspack(config) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    },
  },
};
