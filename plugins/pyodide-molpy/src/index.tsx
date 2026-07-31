/**
 * Pyodide · molpy — MolVis page plugin.
 *
 * Domains:
 * - modes: Python notebook panel (right tools tab)
 * - panels: bottom Console (xterm)
 * - dialogs: Script editor (Monaco)
 * - commands: toolbar opens Script
 * - settings: about
 *
 * InProcess bridge: stage.camera.* → live app.world.camera
 */

import { createHostBridge } from "./bridge/host_bridge";
import { getKernel } from "./kernel/kernel";
import { createPythonMode } from "./modes/python-mode";
import { registerAboutSettings } from "./settings/about/register";
import type { MolvisPluginModule, PluginAPI } from "./types/plugin-api";
import { ConsolePanel } from "./ui/ConsolePanel";
import { NotebookPanel } from "./ui/NotebookPanel";
import { ScriptDialog } from "./ui/ScriptDialog";

const PLUGIN_ID = "com.molcrafts.pyodide-molpy";

/** Shared registration for package entry + official meta-plugin. */
export function registerPyodideMolpy(api: PluginAPI): void {
  const modeId = "python";
  const kernel = getKernel();
  kernel.setBridge(createHostBridge(api.app));

  api.modes.register(
    modeId,
    createPythonMode(`plugin.${api.pluginId}.${modeId}`),
    {
      tab: { label: "Python", order: 50 },
      panel: {
        id: "notebook",
        title: "Notebook",
        render: ({ app }) => {
          // Keep bridge bound if app identity is stable
          kernel.setBridge(createHostBridge(app ?? api.app));
          return <NotebookPanel app={app} storage={api.storage} />;
        },
      },
    },
  );

  api.panels.register({
    id: "console",
    position: "bottom",
    title: "Console",
    defaultOpen: false,
    defaultSize: 0.28,
    render: ({ app }) => <ConsolePanel app={app} />,
  });

  api.dialogs.register({
    id: "script",
    title: "Python script",
    size: "xl",
    render: ({ app, close }) => {
      kernel.setBridge(createHostBridge(app ?? api.app));
      return (
        <ScriptDialog app={app} storage={api.storage} close={close} />
      );
    },
  });

  api.commands.register(
    "open-script",
    () => {
      /* host opens dialog via toolbar.opensDialog */
    },
    {
      toolbar: {
        label: "Script",
        order: 45,
        opensDialog: "script",
      },
    },
  );

  registerAboutSettings(api);

  api.rpc.registerMethod("kernelStatus", () => {
    return { status: kernel.getStatus() };
  });

  api.rpc.registerMethod("runScript", async (params) => {
    const name = String(params.name ?? params.script ?? "");
    if (!name) return { ok: false, error: "name required" };
    kernel.setBridge(createHostBridge(api.app));
    return kernel.runNamedScript(name);
  });
}

const plugin: MolvisPluginModule = {
  id: PLUGIN_ID,
  name: "Pyodide · molpy",
  version: "0.1.0",

  activate(api: PluginAPI) {
    api.log.info("pyodide-molpy activate");
    registerPyodideMolpy(api);
  },

  deactivate(api: PluginAPI) {
    getKernel().setBridge(null);
    api.log.info("pyodide-molpy deactivate");
  },
};

export default plugin;
