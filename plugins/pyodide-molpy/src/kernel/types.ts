export type KernelStatus =
  | "idle"
  | "loading"
  | "ready"
  | "busy"
  | "error";

export type RunSource = "cell" | "script";

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
  /**
   * Last-expression display (`execute_result`), Jupyter mimebundle.
   * Prefer rich types in the UI; always includes `text/plain` when present.
   */
  data?: MimeBundle;
  /** Explicit `display(...)` calls during the cell (`display_data`). */
  displays?: MimeBundle[];
  /** @deprecated use data["text/plain"] */
  resultText?: string;
  error?: string;
}

export type KernelListener = () => void;

export interface KernelLogLine {
  id: string;
  source: RunSource | "system";
  stream: "stdout" | "stderr" | "info";
  text: string;
  cellId?: string;
  at: number;
}
