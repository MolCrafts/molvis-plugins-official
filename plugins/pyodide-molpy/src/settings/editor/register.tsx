import {
  saveEditorSettings,
  useEditorSettings,
} from "../../model/editor_settings";
import type { PluginAPI } from "@molcrafts/molvis-plugin";

export function registerEditorSettings(api: PluginAPI): void {
  api.settings.registerSection({
    id: "editor",
    title: "Python editor",
    group: "Pyodide",
    order: 45,
    render: () => <EditorSettings api={api} />,
  });
}

function EditorSettings({ api }: { api: PluginAPI }) {
  const settings = useEditorSettings(api.storage);

  const setWordWrap = (wordWrap: boolean) => {
    const next = { ...settings, wordWrap };
    saveEditorSettings(api.storage, next);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex min-h-control-compact items-center justify-between gap-3 rounded-control px-0.5">
        <label
          htmlFor="python-editor-overflow"
          className="shrink-0 text-micro text-muted-foreground"
        >
          Long lines
        </label>
        <select
          id="python-editor-overflow"
          value={settings.wordWrap ? "wrap" : "scroll"}
          onChange={(event) => setWordWrap(event.target.value === "wrap")}
          className="h-control-compact rounded-control border border-border bg-panel px-2 text-micro text-foreground outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <option value="scroll">Horizontal scroll</option>
          <option value="wrap">Wrap</option>
        </select>
      </div>
      <p className="text-micro leading-snug text-muted-foreground">
        Toggle while the notebook is focused: <kbd className="font-mono">Alt+Z</kbd>
      </p>
    </div>
  );
}
