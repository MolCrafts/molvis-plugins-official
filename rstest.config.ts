import { defineConfig } from "@rstest/core";
import { molvisNodeRstest } from "./rstest.molvis-node";

export default defineConfig({
  include: ["src/**/*.test.ts"],
  testEnvironment: "node",
  testTimeout: 10_000,
  ...molvisNodeRstest,
});
