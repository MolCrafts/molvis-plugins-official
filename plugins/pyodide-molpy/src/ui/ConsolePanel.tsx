import { XTERM_CSS_URL, XTERM_ESM_URL, XTERM_FIT_ESM_URL } from "../cdn";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKernel } from "./hooks/useKernel";
import {
  readXtermTheme,
  tokens,
  watchHostTheme,
  type XtermTheme,
} from "./theme";

/**
 * Pure xterm body for the host WorkbenchBottomPanel.
 *
 * NO toolbar, NO Clear button, NO "kernel: idle", NO welcome banner.
 * Clear only via right-click context menu.
 *
 * Theme: follows MolVis `--molvis-*` tokens (light/dark), never hard-coded black.
 */
type TermLike = {
  writeln: (s: string) => void;
  open: (el: HTMLElement) => void;
  loadAddon: (a: { fit?: () => void }) => void;
  dispose: () => void;
  clear?: () => void;
  options: { theme?: XtermTheme };
  refresh?: (start: number, end: number) => void;
  rows?: number;
};

type FitLike = { fit: () => void };
type CtxMenu = { x: number; y: number };

async function loadXterm(): Promise<{
  Terminal: new (opts: Record<string, unknown>) => TermLike;
  FitAddon: new () => FitLike;
}> {
  const termUrl = XTERM_ESM_URL;
  const fitUrl = XTERM_FIT_ESM_URL;
  if (typeof document !== "undefined") {
    const id = "molvis-xterm-css";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        XTERM_CSS_URL;
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

function applyTermTheme(term: TermLike, theme: XtermTheme) {
  term.options.theme = theme;
  const rows = term.rows ?? 0;
  if (rows > 0 && term.refresh) {
    try {
      term.refresh(0, rows - 1);
    } catch {
      /* ignore */
    }
  }
}

export function ConsolePanel(_props: { app: unknown }) {
  const { logs, clearLogs } = useKernel();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const termRef = useRef<TermLike | null>(null);
  const writtenIds = useRef(new Set<string>());
  const [menu, setMenu] = useState<CtxMenu | null>(null);
  const [hasTerm, setHasTerm] = useState(false);

  const doClear = useCallback(() => {
    clearLogs();
    writtenIds.current.clear();
    if (preRef.current) preRef.current.textContent = "";
    const term = termRef.current;
    if (term?.clear) term.clear();
    else term?.writeln("\x1b[2J\x1b[H");
    setMenu(null);
  }, [clearLogs]);

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let unwatch: (() => void) | null = null;

    void (async () => {
      try {
        const { Terminal, FitAddon } = await loadXterm();
        if (cancelled || !hostRef.current) return;
        const theme = readXtermTheme(rootRef.current ?? hostRef.current);
        const term = new Terminal({
          convertEol: true,
          fontSize: 12,
          fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          theme,
          disableStdin: true,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(hostRef.current);
        fit.fit();
        termRef.current = term;
        setHasTerm(true);

        // Keep xterm + <pre> fallback in sync with host light/dark.
        unwatch = watchHostTheme(() => {
          const el = rootRef.current ?? hostRef.current;
          if (!el) return;
          const next = readXtermTheme(el);
          if (termRef.current) applyTermTheme(termRef.current, next);
          if (preRef.current) {
            preRef.current.style.background = next.background;
            preRef.current.style.color = next.foreground;
          }
          if (rootRef.current) {
            rootRef.current.style.background = next.background;
          }
        });

        ro = new ResizeObserver(() => {
          try {
            fit.fit();
          } catch {
            /* ignore */
          }
        });
        ro.observe(hostRef.current);
      } catch {
        setHasTerm(false);
      }
    })();

    return () => {
      cancelled = true;
      unwatch?.();
      ro?.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      writtenIds.current.clear();
    };
  }, []);

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
          (preRef.current.textContent ?? "") + `${prefix}${line.text}\n`;
        preRef.current.scrollTop = preRef.current.scrollHeight;
      }
    }
  }, [logs]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const t = window.setTimeout(() => {
      window.addEventListener("pointerdown", close);
      window.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: tokens.panel,
        color: tokens.fg,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div ref={hostRef} style={{ flex: 1, minHeight: 0, padding: 4 }} />
      <pre
        ref={preRef}
        style={{
          display: hasTerm ? "none" : "block",
          flex: 1,
          margin: 0,
          padding: 8,
          overflow: "auto",
          background: tokens.panel,
          color: tokens.fg,
          fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          fontSize: 11,
          whiteSpace: "pre-wrap",
        }}
      />

      {menu ? (
        <div
          role="menu"
          style={{
            position: "fixed",
            left: menu.x,
            top: menu.y,
            zIndex: 10050,
            minWidth: 120,
            padding: 4,
            borderRadius: 6,
            border: `1px solid ${tokens.border}`,
            background: tokens.panelRaised,
            boxShadow: tokens.shadow,
            fontSize: 12,
            color: tokens.fg,
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            style={{
              display: "block",
              width: "100%",
              border: "none",
              background: "transparent",
              textAlign: "left",
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              color: "inherit",
              fontSize: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.interactive;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            onClick={doClear}
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}
