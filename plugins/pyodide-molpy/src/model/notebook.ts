import { CAFFEINE_IPYNB, QUICKSTART_IPYNB } from "../notebooks/generated";
import { createCell, emptyNotebook } from "./cells";
import type { NotebookState } from "./cells";
import { ipynbToNotebook, notebookToIpynbText } from "./ipynb";

export const NOTEBOOK_STORAGE_KEY = "notebook.v1";

type NotebookListener = () => void;
const externalListeners = new Set<NotebookListener>();

/** Subscribe to external notebook replacements (e.g. "IPython: Demo" command). */
export function subscribeNotebookExternal(
  listener: NotebookListener,
): () => void {
  externalListeners.add(listener);
  return () => {
    externalListeners.delete(listener);
  };
}

function notifyNotebookExternal(): void {
  for (const listener of externalListeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Three plain cells: caffeine draw_frame+commit → infinite orbit → style/theme.
 * Used by the "IPython: Demo" command (clear → fill).
 */
export function demoNotebook(): NotebookState {
  return ipynbToNotebook(CAFFEINE_IPYNB);
}

export function defaultNotebook(): NotebookState {
  return ipynbToNotebook(QUICKSTART_IPYNB);
}

/**
 * How many cells are actually persisted, or 0 when nothing is saved.
 *
 * Not `loadNotebook(...).cells.length`: that falls back to the demo
 * notebook, so an untouched install would report cells the user never
 * wrote. Lives here because this module owns the stored shape — a caller
 * counting `JSON.parse(raw).cells` would silently read 0 forever the day
 * the field is renamed.
 */
export function storedCellCount(
  storage: { getItem(k: string): string | null } | null,
): number {
  const raw = storage?.getItem(NOTEBOOK_STORAGE_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as NotebookState;
    return Array.isArray(parsed.cells) ? parsed.cells.length : 0;
  } catch {
    return 0;
  }
}

export function loadNotebook(
  storage: { getItem(k: string): string | null } | null,
): NotebookState {
  if (!storage) return defaultNotebook();
  try {
    const raw = storage.getItem(NOTEBOOK_STORAGE_KEY);
    if (!raw) return defaultNotebook();
    const parsed = JSON.parse(raw) as NotebookState;
    if (!Array.isArray(parsed.cells) || parsed.cells.length === 0) {
      return defaultNotebook();
    }
    // Migrate the old, ambiguous statements-per-second demo option to the
    // explicit seconds-per-step spelling while preserving its timing.
    parsed.cells = parsed.cells.map((cell) => ({
      ...cell,
      source: cell.source.replace(
        /^(\s*%%mv\.demo\s+)rate=([0-9]*\.?[0-9]+)(.*)$/m,
        (_line, prefix: string, value: string, suffix: string) => {
          const rate = Number(value);
          return `${prefix}delay=${rate > 0 ? 1 / rate : 0}${suffix}`;
        },
      ),
    }));
    parsed.cells = parsed.cells.map((cell) => ({
      ...cell,
      source: cell.source.replace(/^(\s*%%mv\.demo\s+)step_delay=/m, "$1delay="),
    }));
    return parsed;
  } catch {
    return defaultNotebook();
  }
}

export function saveNotebook(
  storage: { setItem(k: string, v: string): void } | null,
  state: NotebookState,
): void {
  try {
    storage?.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function downloadNotebookIpynb(state: NotebookState, filename = "notebook.ipynb"): void {
  const url = URL.createObjectURL(
    new Blob([notebookToIpynbText(state)], { type: "application/x-ipynb+json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Clear the notebook and fill with the caffeine demo cells
 * (draw_frame+commit → orbit → style then theme tours). Persists to
 * storage and notifies open NotebookPanel instances.
 */
export function resetToDemoNotebook(
  storage: {
    getItem(k: string): string | null;
    setItem(k: string, v: string): void;
  } | null,
): NotebookState {
  const next = demoNotebook();
  saveNotebook(storage, next);
  notifyNotebookExternal();
  return next;
}
