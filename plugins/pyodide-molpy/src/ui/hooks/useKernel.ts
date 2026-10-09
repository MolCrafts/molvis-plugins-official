import { useCallback, useSyncExternalStore } from "react";
import {
  loadKernel,
  loadedKernel,
} from "../../kernel";
import type {
  KernelLogLine,
  KernelStatus,
  RunResult,
  RunSource,
} from "../../kernel";

const EMPTY_LOGS: KernelLogLine[] = [];

function subscribeKernel(onStoreChange: () => void): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void loadKernel().then((kernel) => {
    if (cancelled) return;
    unsubscribe = kernel.subscribe(onStoreChange);
    onStoreChange();
  });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export function useKernel() {
  const status = useSyncExternalStore(
    subscribeKernel,
    () => loadedKernel()?.getStatus() ?? "idle",
    () => "idle" as KernelStatus,
  );
  const logs = useSyncExternalStore(
    subscribeKernel,
    () => loadedKernel()?.getLogs() ?? EMPTY_LOGS,
    () => EMPTY_LOGS,
  );
  const lastError = useSyncExternalStore(
    subscribeKernel,
    () => loadedKernel()?.getLastError() ?? null,
    () => null,
  );

  const start = useCallback(
    () => loadKernel().then((kernel) => kernel.start()),
    [],
  );
  const reset = useCallback(
    () => loadKernel().then((kernel) => kernel.reset()),
    [],
  );
  const interrupt = useCallback(() => {
    loadedKernel()?.interrupt();
  }, []);
  const clearLogs = useCallback(() => {
    loadedKernel()?.clearLogs();
  }, []);
  const run = useCallback(
    (code: string, source: RunSource, meta?: { cellId?: string }) =>
      loadKernel().then((kernel) => kernel.run(code, source, meta)),
    [],
  );
  const runNamedScript = useCallback(
    (name: string) => loadKernel().then((kernel) => kernel.runNamedScript(name)),
    [],
  );
  const syncScripts = useCallback(
    (map: Record<string, string>) =>
      loadKernel().then((kernel) => kernel.syncScripts(map)),
    [],
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
