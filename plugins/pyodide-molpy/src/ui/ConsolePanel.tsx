import { useEffect, useRef } from "react";
import { useKernel } from "./hooks/useKernel";
import { css } from "./styles";

type TermLike = {
  writeln: (s: string) => void;
  open: (el: HTMLElement) => void;
  loadAddon: (a: { fit?: () => void }) => void;
  dispose: () => void;
};

type FitLike = { fit: () => void };

async function loadXterm(): Promise<{
  Terminal: new (opts: Record<string, unknown>) => TermLike;
  FitAddon: new () => FitLike;
}> {
  const termUrl = "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/+esm";
  const fitUrl = "https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/+esm";
  if (typeof document !== "undefined") {
    const id = "molvis-xterm-css";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css";
      document.head.appendChild(link);
    }
  }
  const [termMod, fitMod] = await Promise.all([
    import(/* webpackIgnore: true */ /* @vite-ignore */ termUrl),
    import(/* webpackIgnore: true */ /* @vite-ignore */ fitUrl),
  ]);
  const Terminal =
    (termMod as { Terminal?: unknown; default?: { Terminal: unknown } })
      .Terminal ??
    (termMod as { default: { Terminal: unknown } }).default?.Terminal ??
    (termMod as { default: unknown }).default;
  const FitAddon =
    (fitMod as { FitAddon?: unknown; default?: { FitAddon: unknown } })
      .FitAddon ??
    (fitMod as { default: { FitAddon: unknown } }).default?.FitAddon ??
    (fitMod as { default: unknown }).default;
  return {
    Terminal: Terminal as new (opts: Record<string, unknown>) => TermLike,
    FitAddon: FitAddon as new () => FitLike,
  };
}

/**
 * Bottom console: prefers xterm.js from CDN; falls back to a <pre> log.
 */
export function ConsolePanel(_props: { app: unknown }) {
  const { logs, clearLogs, status } = useKernel();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const termRef = useRef<TermLike | null>(null);
  const writtenIds = useRef(new Set<string>());
  const useFallback = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    void (async () => {
      try {
        const { Terminal, FitAddon } = await loadXterm();
        if (cancelled || !hostRef.current) return;
        const term = new Terminal({
          convertEol: true,
          fontSize: 12,
          fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          theme: {
            background: "#0f1412",
            foreground: "#e8f0eb",
            cursor: "#e8f0eb",
          },
          disableStdin: true,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(hostRef.current);
        fit.fit();
        term.writeln("MolVis Python console");
        term.writeln(`status: ${status}`);
        termRef.current = term;
        ro = new ResizeObserver(() => {
          try {
            fit.fit();
          } catch {
            /* ignore */
          }
        });
        ro.observe(hostRef.current);
      } catch {
        useFallback.current = true;
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      writtenIds.current.clear();
    };
  }, [status]);

  useEffect(() => {
    const term = termRef.current;
    for (const line of logs) {
      if (writtenIds.current.has(line.id)) continue;
      writtenIds.current.add(line.id);
      const prefix =
        line.source === "system"
          ? "[sys] "
          : line.source === "script"
            ? "[script] "
            : line.cellId
              ? `[cell ${line.cellId.slice(-4)}] `
              : "[cell] ";
      const text = `${prefix}${line.text}`;
      if (term) {
        const color =
          line.stream === "stderr"
            ? "\x1b[31m"
            : line.stream === "info"
              ? "\x1b[36m"
              : "";
        const reset = color ? "\x1b[0m" : "";
        for (const part of line.text.split("\n")) {
          term.writeln(`${color}${prefix}${part}${reset}`);
        }
      } else if (preRef.current) {
        preRef.current.textContent =
          (preRef.current.textContent ?? "") + text + "\n";
        preRef.current.scrollTop = preRef.current.scrollHeight;
      }
    }
  }, [logs]);

  return (
    <div style={css.consoleHost}>
      <div style={css.consoleBar}>
        <button
          type="button"
          style={css.btn()}
          onClick={() => {
            clearLogs();
            writtenIds.current.clear();
            if (preRef.current) preRef.current.textContent = "";
          }}
        >
          Clear
        </button>
        <span style={css.status}>kernel: {status}</span>
      </div>
      <div ref={hostRef} style={css.xterm} />
      <pre
        ref={preRef}
        style={{
          ...css.out,
          display: termRef.current ? "none" : "block",
          flex: 1,
          maxHeight: "none",
          margin: 0,
          background: "#0f1412",
          color: "#e8f0eb",
        }}
      />
    </div>
  );
}
