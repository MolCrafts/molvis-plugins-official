/**
 * Pyodide · molpy — MolVis page plugin.
 *
 * Viewer control: molvis-python ``InProcessTransport`` → page ``RPCRouter``
 * (same JSON-RPC catalog as WebSocket). No hard-coded camera/scene bridge.
 */

import { getKernel } from "./kernel/kernel";
import { EDITOR_SETTINGS_KEY } from "./model/editor_settings";
import {
  NOTEBOOK_STORAGE_KEY,
  resetToDemoNotebook,
  storedCellCount,
} from "./model/notebook";
import { SCRIPTS_STORAGE_KEY, storedScriptCount } from "./model/scripts";
import { createPythonMode } from "./modes/python-mode";
import { createRpcClient } from "./rpc/client";
import { registerVersionSettings } from "./settings/about/register";
import { registerEditorSettings } from "./settings/editor/register";
import type { MolvisPluginModule, PluginAPI } from "./types/plugin-api";
import { ConsolePanel } from "./ui/ConsolePanel";
import { NotebookPanel } from "./ui/NotebookPanel";
import { ScriptDialog } from "./ui/ScriptDialog";
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_VERSION } from "./version";

function bindApp(api: PluginAPI, app?: unknown): void {
  const target = app ?? api.app;
  getKernel().setApp(target ?? null);
}

/**
 * Declare the notebook and script library as clearable.
 *
 * The host cannot make this call: it sees two opaque `localStorage` keys
 * and has no way to know they are safe to drop. They are — both fall back
 * to the demo notebook / empty library on next load — so this plugin opts
 * them into "Clear cache" explicitly.
 */
function registerCaches(api: PluginAPI): void {
  api.caches.register({
    id: "notebook",
    label: "Python notebook cells",
    describe: () => {
      const n = storedCellCount(api.storage);
      return n === 0 ? "empty" : `${n} cell${n === 1 ? "" : "s"}`;
    },
    clear: () => api.storage.removeItem(NOTEBOOK_STORAGE_KEY),
  });

  api.caches.register({
    id: "scripts",
    label: "Python script library",
    describe: () => {
      const n = storedScriptCount(api.storage);
      return n === 0 ? "empty" : `${n} script${n === 1 ? "" : "s"}`;
    },
    clear: () => api.storage.removeItem(SCRIPTS_STORAGE_KEY),
  });

  api.caches.register({
    id: "editor-settings",
    label: "Python editor settings",
    describe: () =>
      api.storage.getItem(EDITOR_SETTINGS_KEY) ? "customized" : "default",
    clear: () => api.storage.removeItem(EDITOR_SETTINGS_KEY),
  });
}

/** Shared registration for package entry + official meta-plugin. */
export function registerPyodideMolpy(api: PluginAPI): void {
  registerCaches(api);
  const modeId = "python";
  const pythonModeId = `plugin.${api.pluginId}.${modeId}`;
  bindApp(api);

  api.modes.register(
    modeId,
    createPythonMode(pythonModeId),
    {
      tab: { label: "Python", order: 50 },
      panel: {
        id: "notebook",
        title: "Notebook",
        render: ({ app }) => {
          bindApp(api, app);
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
      bindApp(api, app);
      return (
        <ScriptDialog app={app} storage={api.storage} close={close} />
      );
    },
  });

  api.commands.register(
    "open-script",
    () => {
      /* host opens dialog via palette metadata opensDialog */
    },
    {
      toolbar: {
        label: "Python: Open script",
        order: 45,
        opensDialog: "script",
      },
    },
  );

  api.commands.register(
    "open-notebook",
    () => {
      api.app.setMode(pythonModeId);
    },
    {
      toolbar: {
        label: "Python: Notebook",
        order: 40,
      },
    },
  );

  // Clear notebook → caffeine draw → slow orbit → %%mv.demo style tour.
  api.commands.register(
    "ipython-demo",
    () => {
      bindApp(api);
      api.app.setMode(pythonModeId);
      resetToDemoNotebook(api.storage);
      api.log.info(
        "IPython: Demo — caffeine · draw → slow orbit → %%mv.demo styles",
      );
    },
    {
      toolbar: {
        label: "IPython: Demo",
        order: 41,
      },
    },
  );

  registerEditorSettings(api);
  registerVersionSettings(api);

  api.rpc.registerMethod("kernelStatus", () => {
    return { status: getKernel().getStatus() };
  });

  api.rpc.registerMethod("runScript", async (params) => {
    const name = String(params.name ?? params.script ?? "");
    if (!name) return { ok: false, error: "name required" };
    bindApp(api);
    return getKernel().runNamedScript(name);
  });
}

const plugin: MolvisPluginModule = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  version: PLUGIN_VERSION,

  activate(api: PluginAPI) {
    api.log.info("pyodide-molpy activate (InProcessTransport → RPCRouter)");
    // Warm the RPC client construction path (validates stage export).
    try {
      createRpcClient(api.app);
    } catch (err) {
      api.log.warn("RPC client preflight:", err);
    }
    registerPyodideMolpy(api);
  },

  deactivate(api: PluginAPI) {
    getKernel().setApp(null);
    api.log.info("pyodide-molpy deactivate");
  },
};

export default plugin;
