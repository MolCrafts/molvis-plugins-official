import { useEffect, useState } from "react";
import type { PluginStorage } from "../types/plugin-api";

export const EDITOR_SETTINGS_KEY = "editor-settings.v1";

export interface NotebookEditorSettings {
  wordWrap: boolean;
}

const DEFAULTS: NotebookEditorSettings = { wordWrap: false };
const listeners = new Set<() => void>();

export function loadEditorSettings(
  storage: PluginStorage | null,
): NotebookEditorSettings {
  try {
    const value = JSON.parse(storage?.getItem(EDITOR_SETTINGS_KEY) ?? "null") as
      | Partial<NotebookEditorSettings>
      | null;
    return { wordWrap: value?.wordWrap === true };
  } catch {
    return DEFAULTS;
  }
}

export function saveEditorSettings(
  storage: PluginStorage | null,
  value: NotebookEditorSettings,
): void {
  storage?.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(value));
  for (const listener of listeners) listener();
}

export function useEditorSettings(
  storage: PluginStorage | null,
): NotebookEditorSettings {
  const [settings, setSettings] = useState(() => loadEditorSettings(storage));
  useEffect(() => {
    const listener = () => setSettings(loadEditorSettings(storage));
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [storage]);
  return settings;
}
