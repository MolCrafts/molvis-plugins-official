export { isInterruptError } from "./errors";
export type {
  KernelListener,
  KernelLogLine,
  KernelStatus,
  MimeBundle,
  RunResult,
  RunSource,
} from "./types";

import type { HostKernel } from "./host_kernel";

/**
 * The Pyodide runtime stays out of the plugin's import graph.
 *
 * `host_kernel` pulls `@jupyterlite/pyodide-kernel`, which cannot load
 * outside the rsbuild substitution for `_pypi`. Importing this barrel —
 * the collection does, on activate — must not execute that module.
 * The first notebook, console, or script action loads it.
 */
let kernel: HostKernel | null = null;
let loading: Promise<HostKernel> | null = null;

/** The runtime if a caller has already asked for it. Never starts a load. */
export function loadedKernel(): HostKernel | null {
  return kernel;
}

/** Load the runtime once. Concurrent callers share one import. */
export function loadKernel(): Promise<HostKernel> {
  if (kernel) return Promise.resolve(kernel);
  if (!loading) {
    loading = import("./host_kernel").then((mod) => {
      kernel = mod.getKernel();
      return kernel;
    });
  }
  return loading;
}

/** Drop the app reference without pulling the runtime in to do it. */
export function releaseKernelApp(): void {
  kernel?.setApp(null);
}
