export interface NotebookCell {
  id: string;
  source: string;
  output: string;
  execCount: number | null;
  status: "idle" | "running" | "ok" | "error";
}

export interface NotebookState {
  cells: NotebookCell[];
  nextExec: number;
}

const STORAGE_KEY = "notebook.v1";

export function createCell(source = ""): NotebookCell {
  return {
    id: `cell-${Math.random().toString(36).slice(2, 10)}`,
    source,
    output: "",
    execCount: null,
    status: "idle",
  };
}

export function defaultNotebook(): NotebookState {
  return {
    cells: [
      createCell(
        [
          "# Notebook cells are plain text (no Monaco).",
          "# Named scripts live in the Script dialog; call them here:",
          "import molvis as mv",
          "print('scripts:', mv.list_scripts())",
          'mv.run("camera.py")  # runs the library script',
        ].join("\n"),
      ),
    ],
    nextExec: 1,
  };
}

export function loadNotebook(
  storage: { getItem(k: string): string | null } | null,
): NotebookState {
  if (!storage) return defaultNotebook();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultNotebook();
    const parsed = JSON.parse(raw) as NotebookState;
    if (!Array.isArray(parsed.cells) || parsed.cells.length === 0) {
      return defaultNotebook();
    }
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
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export const NOTEBOOK_STORAGE_KEY = STORAGE_KEY;
