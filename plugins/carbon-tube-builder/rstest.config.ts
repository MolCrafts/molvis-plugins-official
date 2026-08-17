import { defineConfig } from "@rstest/core";
import { molvisNodeRstest } from "../../rstest.molvis-node";

export default defineConfig({
  testEnvironment: "node",
  include: ["tests/**/*.test.ts"],
  ...molvisNodeRstest,
});
