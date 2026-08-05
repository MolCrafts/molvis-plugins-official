/** Public kernel types for the MolVis Pyodide host (UI-facing). */

export type KernelStatus =
  | "idle"
  | "loading"
  | "ready"
  | "busy"
  | "error";

export type RunSource = "cell" | "script" | "system";

/**
 * Jupyter-style MIME bundle: type → payload.
 * Images are base64 (no data: prefix). Strings are UTF-8 text.
 */
export type MimeBundle = Record<string, string>;

export interface RunResult {
  ok: boolean;
  /** The user stopped the active cell. */
  interrupted?: boolean;
  stdout: string;
  stderr: string;
  /** Last-expression display (`execute_result`). */
  data?: MimeBundle;
  /** Explicit `display(...)` calls (`display_data`). */
  displays?: MimeBundle[];
  error?: string;
}

export type KernelListener = () => void;

export interface KernelLogLine {
  id: string;
  source: RunSource;
  stream: "stdout" | "stderr" | "info";
  text: string;
  cellId?: string;
  at: number;
}
