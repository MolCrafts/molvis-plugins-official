import {
  DEMO_CAFFEINE_BUILD,
  DEMO_CAFFEINE_ORBIT,
  DEMO_CAFFEINE_STYLES,
} from "../demo/cells";
import type { MimeBundle } from "../kernel/types";

export interface NotebookCell {
  id: string;
  source: string;
  /** Captured stdout/stderr streams for this execution. */
  output: string;
  /**
   * Jupyter `execute_result` + `display_data` mimebundles from the last run.
   * First entry is the last-expression result when present; following entries
   * are mid-cell `display(...)` publications.
   */
  displays?: MimeBundle[];
  execCount: number | null;
  status: "idle" | "running" | "ok" | "error";
  /** User-dragged editor height (px). Auto-size respects this as a floor. */
  editorHeight?: number;
}

export interface NotebookState {
  cells: NotebookCell[];
  nextExec: number;
}

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

export function createCell(source = ""): NotebookCell {
  return {
    id: `cell-${Math.random().toString(36).slice(2, 10)}`,
    source,
    displays: undefined,
    output: "",
    execCount: null,
    status: "idle",
  };
}

/** Empty shell — one blank cell. */
export function emptyNotebook(): NotebookState {
  return {
    cells: [createCell()],
    nextExec: 1,
  };
}

/**
 * Three plain cells: caffeine draw_frame+commit → infinite orbit → style/theme.
 * Used by the "IPython: Demo" command (clear → fill).
 */
export function demoNotebook(): NotebookState {
  return {
    cells: [
      createCell(DEMO_CAFFEINE_BUILD),
      createCell(DEMO_CAFFEINE_ORBIT),
      createCell(DEMO_CAFFEINE_STYLES),
    ],
    nextExec: 1,
  };
}

export function defaultNotebook(): NotebookState {
  return {
    cells: [
      createCell(
        [
          "# Quick start — plain cell (no magic).",
          "import molvis as mv",
          "stage = mv.Stage()  # reuses kernel in-process stage",
          "print('stage:', stage.name)",
          "print('scripts:', mv.list_scripts())",
          'mv.run("camera.py")  # named script from the Script library',
        ].join("\n"),
      ),
    ],
    nextExec: 1,
  };
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

/** Serialize the current notebook as a Jupyter nbformat 4 document. */
export function notebookToIpynb(state: NotebookState): string {
  const cells = state.cells.map((cell) => ({
    cell_type: "code",
    execution_count: cell.execCount,
    metadata: {},
    outputs: [],
    source: cell.source.split(/(?<=\n)/),
  }));
  return JSON.stringify({
    cells,
    metadata: {
      kernelspec: { display_name: "Python (Pyodide)", language: "python", name: "python3" },
      language_info: { name: "python" },
    },
    nbformat: 4,
    nbformat_minor: 5,
  }, null, 2);
}

export function downloadNotebookIpynb(state: NotebookState, filename = "notebook.ipynb"): void {
  const url = URL.createObjectURL(new Blob([notebookToIpynb(state)], { type: "application/x-ipynb+json" }));
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
