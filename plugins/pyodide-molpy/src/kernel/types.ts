export type KernelStatus =
  | "idle"
  | "loading"
  | "ready"
  | "busy"
  | "error";

export type RunSource = "cell" | "script";

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  /** Repr of last expression when available. */
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
