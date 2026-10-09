import type { KernelStatus } from "../kernel/types";

export type KernelStatusCopy = {
  /** Short Colab-style label. */
  title: string;
  /** One-line hint / last error. */
  hint: string;
};

/** Toolbar tooltip for the single kernel button. The click action matches it. */
export function kernelButtonLabel(status: KernelStatus): string {
  switch (status) {
    case "idle":
      return "Start kernel";
    case "loading":
      return "Starting kernel…";
    case "ready":
      return "Kernel ready — click to restart";
    case "busy":
      return "Kernel running — click to interrupt";
    case "error":
      return "Kernel failed — click to restart";
  }
}

/** Footer copy for the notebook status bar. */
export function describeKernelStatus(
  status: KernelStatus,
  lastError: string | null,
): KernelStatusCopy {
  switch (status) {
    case "idle":
      return { title: "Not connected", hint: "Click to start" };
    case "loading":
      return { title: "Connecting…", hint: "Starting Pyodide" };
    case "ready":
      return { title: "Connected", hint: "Pyodide" };
    case "busy":
      return { title: "Running", hint: "Click to interrupt" };
    case "error": {
      const err = lastError?.trim();
      return {
        title: "Disconnected",
        hint: err && err.length > 0 ? err : "Click to retry",
      };
    }
  }
}
