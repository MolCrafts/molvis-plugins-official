import { useCallback, useEffect, useState } from "react";
import {
  createCell,
  loadNotebook,
  saveNotebook,
  type NotebookCell,
  type NotebookState,
} from "../model/notebook";
import { loadLibrary, scriptsMap } from "../model/scripts";
import type { PluginStorage } from "../types/plugin-api";
import { useKernel } from "./hooks/useKernel";
import { css } from "./styles";

export function NotebookPanel({
  storage,
}: {
  app: unknown;
  storage: PluginStorage | null;
}) {
  const { status, run, start, reset, syncScripts } = useKernel();
  const [nb, setNb] = useState<NotebookState>(() => loadNotebook(storage));

  // Keep named scripts (Monaco library) available to mv.run(...) from cells.
  useEffect(() => {
    void syncScripts(scriptsMap(loadLibrary(storage)));
  }, [storage, syncScripts]);

  const persist = useCallback(
    (next: NotebookState) => {
      setNb(next);
      saveNotebook(storage, next);
    },
    [storage],
  );

  const updateCell = (id: string, patch: Partial<NotebookCell>) => {
    persist({
      ...nb,
      cells: nb.cells.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const runCell = async (id: string) => {
    const cell = nb.cells.find((c) => c.id === id);
    if (!cell) return;
    updateCell(id, { status: "running", output: "" });
    const result = await run(cell.source, "cell", { cellId: id });
    const out = [result.stdout, result.stderr, result.resultText, result.error]
      .filter(Boolean)
      .join("");
    setNb((prev) => {
      const nextExec = result.ok ? prev.nextExec + 1 : prev.nextExec;
      const next: NotebookState = {
        nextExec,
        cells: prev.cells.map((c) =>
          c.id === id
            ? {
                ...c,
                status: result.ok ? "ok" : "error",
                output: out || (result.ok ? "(no output)" : result.error ?? ""),
                execCount: result.ok ? prev.nextExec : c.execCount,
              }
            : c,
        ),
      };
      saveNotebook(storage, next);
      return next;
    });
  };

  const runAll = async () => {
    for (const cell of nb.cells) {
      await runCell(cell.id);
    }
  };

  return (
    <div style={css.root}>
      <div style={css.toolbar}>
        <button
          type="button"
          style={css.btn("primary")}
          onClick={() => void start()}
          disabled={status === "loading" || status === "busy"}
        >
          Start kernel
        </button>
        <button
          type="button"
          style={css.btn()}
          onClick={() =>
            persist({
              ...nb,
              cells: [...nb.cells, createCell()],
            })
          }
        >
          + Cell
        </button>
        <button
          type="button"
          style={css.btn("primary")}
          onClick={() => void runAll()}
          disabled={status === "busy" || status === "loading"}
        >
          Run all
        </button>
        <button
          type="button"
          style={css.btn("danger")}
          onClick={() => {
            if (globalThis.confirm?.("Reset Python kernel?")) {
              void reset();
            }
          }}
        >
          Reset
        </button>
        <span style={css.status}>kernel: {status}</span>
      </div>

      <div style={css.cells}>
        {nb.cells.map((cell, index) => (
          <div key={cell.id} style={css.cell}>
            <div style={css.cellHead}>
              <span>
                In [{cell.execCount ?? " "}] · #{index + 1}
              </span>
              <button
                type="button"
                style={css.btn("primary")}
                disabled={status === "busy"}
                onClick={() => void runCell(cell.id)}
              >
                Run
              </button>
              <button
                type="button"
                style={css.btn()}
                onClick={() =>
                  persist({
                    ...nb,
                    cells: nb.cells.filter((c) => c.id !== cell.id).length
                      ? nb.cells.filter((c) => c.id !== cell.id)
                      : [createCell()],
                  })
                }
              >
                Delete
              </button>
              <span style={{ marginLeft: "auto", opacity: 0.7 }}>
                {cell.status}
              </span>
            </div>
            <textarea
              style={css.textarea}
              value={cell.source}
              spellCheck={false}
              onChange={(e) => updateCell(cell.id, { source: e.target.value })}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void runCell(cell.id);
                }
              }}
            />
            {cell.output ? <div style={css.out}>{cell.output}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
