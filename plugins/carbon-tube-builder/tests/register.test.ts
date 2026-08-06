import type { ModePanelSpec } from "@molcrafts/molvis-plugin";
import { fakePluginAPI } from "@molcrafts/molvis-plugin/testing";
import { describe, expect, it } from "@rstest/core";
import plugin, { registerCarbonTubeBuilder } from "../src/index";
import { PLUGIN_ID } from "../src/version";

function recordToolsPanels() {
  const panels: Array<{ mode: string; panel: ModePanelSpec }> = [];
  const api = fakePluginAPI({
    modes: {
      register() {},
      registerToolsPanel(mode: string, panel: ModePanelSpec) {
        panels.push({ mode, panel });
      },
    },
  });
  return { api, panels };
}

describe("carbon-tube-builder registration", () => {
  it("contributes a tools panel to the edit mode", () => {
    // This plugin's whole contribution is one tools panel; if the mode id or
    // the panel id drifts, the builder silently disappears from the UI and
    // nothing else in the repo notices.
    const { api, panels } = recordToolsPanels();
    registerCarbonTubeBuilder(api);
    expect(panels).toHaveLength(1);
    expect(panels[0].mode).toBe("edit");
    expect(panels[0].panel.id).toBe("carbon-tube-builder");
  });

  it("activating the plugin performs that registration", () => {
    const { api, panels } = recordToolsPanels();
    plugin.activate(api);
    expect(panels).toHaveLength(1);
  });

  it("declares the id the host installs", () => {
    expect(plugin.id).toBe(PLUGIN_ID);
  });

  it("deactivates without throwing", () => {
    const { api } = recordToolsPanels();
    plugin.activate(api);
    expect(() => plugin.deactivate?.(api)).not.toThrow();
  });
});
