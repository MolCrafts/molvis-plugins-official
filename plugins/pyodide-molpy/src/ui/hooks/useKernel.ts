import { useCallback, useSyncExternalStore } from "react";
import { getKernel } from "../../kernel";
import type {
  KernelLogLine,
  KernelStatus,
  RunResult,
  RunSource,
} from "../../kernel";

export function useKernel() {
  const kernel = getKernel();
  const status = useSyncExternalStore(
    (cb) => kernel.subscribe(cb),
    () => kernel.getStatus(),
    () => kernel.getStatus(),
  );
  const logs = useSyncExternalStore(
    (cb) => kernel.subscribe(cb),
    () => kernel.getLogs(),
    () => kernel.getLogs(),
  );
  const lastError = useSyncExternalStore(
    (cb) => kernel.subscribe(cb),
    () => kernel.getLastError(),
    () => kernel.getLastError(),
  );

  const start = useCallback(() => kernel.start(), [kernel]);
  const reset = useCallback(() => kernel.reset(), [kernel]);
  const interrupt = useCallback(() => kernel.interrupt(), [kernel]);
  const clearLogs = useCallback(() => kernel.clearLogs(), [kernel]);
  const run = useCallback(
    (code: string, source: RunSource, meta?: { cellId?: string }) =>
      kernel.run(code, source, meta),
    [kernel],
  );
  const runNamedScript = useCallback(
    (name: string) => kernel.runNamedScript(name),
    [kernel],
  );
  const syncScripts = useCallback(
    (map: Record<string, string>) => kernel.syncScripts(map),
    [kernel],
  );

  return {
    status: status as KernelStatus,
    logs: logs as KernelLogLine[],
    lastError,
    start,
    reset,
    interrupt,
    clearLogs,
    run,
    runNamedScript,
    syncScripts,
  };
}

export type { RunResult };
