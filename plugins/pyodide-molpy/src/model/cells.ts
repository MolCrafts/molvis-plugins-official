/**
 * The notebook's unit of content.
 *
 * Split from `notebook.ts` so the `.ipynb` reader/writer can construct cells
 * without importing the store — otherwise the two modules form a cycle
 * (`notebook` seeds itself from an `.ipynb`, `ipynb` builds cells).
 */

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
  return { cells: [createCell()], nextExec: 1 };
}
