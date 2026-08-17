import { describe, expect, it } from "@rstest/core";
import {
  isLoopbackPluginHost,
  PIPLITE_WHEEL,
  pluginRepoUrl,
} from "../src/kernel/runtime_assets";

describe("pluginRepoUrl", () => {
  it("walks up from /dist/ to the served repo root", () => {
    expect(pluginRepoUrl("molvis-src/", "http://127.0.0.1:4173/dist/")).toBe(
      "http://127.0.0.1:4173/molvis-src/",
    );
  });

  it("stays flat when plugin.js is not under dist/", () => {
    expect(
      pluginRepoUrl("molvis-src/", "https://example.com/releases/v1/"),
    ).toBe("https://example.com/releases/v1/molvis-src/");
  });
});

describe("PIPLITE_WHEEL", () => {
  it("matches the wheel shipped by the installed jupyterlite kernel", () => {
    expect(PIPLITE_WHEEL).toMatch(/^piplite-.+-py3-none-any\.whl$/);
  });
});

describe("isLoopbackPluginHost", () => {
  it("detects local serve", () => {
    expect(isLoopbackPluginHost("http://127.0.0.1:4173/dist/")).toBe(true);
    expect(isLoopbackPluginHost("http://localhost:4173/dist/")).toBe(true);
    expect(isLoopbackPluginHost("https://cdn.example/plugin/")).toBe(false);
  });
});
