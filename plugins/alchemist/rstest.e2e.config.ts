import { defineConfig } from "@rstest/core";

export default defineConfig({
  include: ["tests/**/*.e2e.test.ts"],
  testEnvironment: "node",
  testTimeout: 30_000,
});

