/**
 * Match MolVis page tool panels (Select / View density):
 * transparent surface · 1px hairlines · ghost icon actions · mono body.
 * Never filled green pills — accent is icon color only.
 *
 * Token names match host `page/src/styles/tailwind.css` (`--molvis-*`).
 */
import { FONT } from "@molcrafts/molvis-plugin";
import { tokens } from "./theme";

const border = tokens.border;
const fg = tokens.fg;
const muted = tokens.mutedFg;
const accent = tokens.accent;
const danger = tokens.failed;
const interactive = tokens.interactive;

export const css = {
  root: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    minHeight: 0,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize: 12,
    color: fg,
    background: "transparent",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    minHeight: 28,
    padding: "0 2px",
    flexShrink: 0,
    borderBottom: `1px solid ${border}`,
  },
  iconBtn: (opts?: {
    danger?: boolean;
    accent?: boolean;
    disabled?: boolean;
  }) =>
    ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 28,
      padding: 0,
      margin: 0,
      border: "none",
      borderRadius: 6,
      background: "transparent",
      color: opts?.danger ? danger : opts?.accent ? accent : muted,
      opacity: opts?.disabled ? 0.4 : 1,
      cursor: opts?.disabled ? "not-allowed" : "pointer",
      flexShrink: 0,
    }) as const,
  status: {
    marginLeft: "auto",
    fontSize: 11,
    fontFamily: FONT.mono,
    color: muted,
    fontVariantNumeric: "tabular-nums" as const,
    paddingRight: 6,
    userSelect: "none" as const,
  },
  /** Pushes the kernel group to the trailing edge of the toolbar. */
  toolbarSpacer: {
    marginLeft: "auto",
  },
  /** Hairline between the run group and the kernel group. */
  toolbarDivider: {
    width: 1,
    height: 16,
    background: border,
    margin: "0 4px",
    flexShrink: 0,
  },

  cells: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    display: "flex",
    flexDirection: "column" as const,
  },
  editorError: {
    padding: "6px 10px",
    borderBottom: `1px solid ${border}`,
    color: danger,
    fontSize: 11,
    lineHeight: 1.4,
    background: "transparent",
  },
  /**
   * Hover strip between cells — line spans full panel width (matches cell
   * hairline border); + sits centered on that line.
   */
  insertGap: {
    position: "relative" as const,
    height: 12,
    marginTop: -1,
    marginBottom: -1,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 2,
  },
  insertGapLine: (visible: boolean) =>
    ({
      position: "absolute" as const,
      left: 0,
      right: 0,
      top: "50%",
      height: 1,
      marginTop: -0.5,
      background: visible ? accent : border,
      opacity: visible ? 0.85 : 1,
      transition: "background 80ms ease, opacity 80ms ease",
      pointerEvents: "none" as const,
    }) as const,
  insertGapBtn: (visible: boolean) =>
    ({
      position: "relative" as const,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 18,
      height: 18,
      borderRadius: 999,
      border: `1px solid ${visible ? accent : border}`,
      background: tokens.panel,
      color: accent,
      fontSize: 14,
      fontWeight: 600,
      lineHeight: 1,
      opacity: visible ? 1 : 0,
      transition: "opacity 80ms ease, border-color 80ms ease",
      pointerEvents: "none" as const,
      boxShadow: visible ? tokens.shadow : "none",
      zIndex: 1,
    }) as const,
  cell: {
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "stretch",
    // Border is drawn by insertGap hairline so + / line stay edge-aligned.
    borderBottom: "none",
    background: "transparent",
  },
  cellRunning: {
    outline: `1px solid ${accent}`,
    outlineOffset: -1,
  },
  /**
   * Marks the cell the toolbar's run buttons act on. A left bar rather
   * than an outline, so it never competes with `cellRunning` — a cell can
   * be both selected and running at once.
   */
  cellSelected: {
    boxShadow: `inset 2px 0 0 ${accent}`,
  },
  gutter: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 2,
    width: 36,
    flexShrink: 0,
    padding: "4px 0",
    borderRight: `1px solid ${border}`,
  },
  prompt: {
    fontSize: 10,
    fontFamily: FONT.mono,
    color: muted,
    fontVariantNumeric: "tabular-nums" as const,
    lineHeight: 1.2,
    userSelect: "none" as const,
  },
  cellMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column" as const,
  },
  textarea: {
    width: "100%",
    minHeight: 48,
    border: "none",
    resize: "vertical" as const,
    overflow: "hidden" as const,
    padding: "6px 8px",
    fontFamily: FONT.mono,
    fontSize: 12,
    lineHeight: 1.45,
    background: "transparent",
    color: "inherit",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  out: {
    padding: "0 8px 8px",
    whiteSpace: "pre-wrap" as const,
    fontFamily: FONT.mono,
    fontSize: 11,
    lineHeight: 1.4,
    color: muted,
    maxHeight: 200,
    overflow: "auto",
    borderTop: `1px solid ${border}`,
    marginTop: 0,
    paddingTop: 6,
  },
  outError: {
    color: danger,
  },
  /** Jupyter execute_result / display_data rich payloads (html, svg, images). */
  outRich: {
    padding: "6px 8px 8px",
    borderTop: `1px solid ${border}`,
    maxHeight: 320,
    overflow: "auto",
    fontSize: 12,
    lineHeight: 1.4,
    color: fg,
  },
  outImage: {
    display: "block",
    maxWidth: "100%",
    height: "auto",
  },
  /** Tiny CSS spinner for the cell gutter while status === "running". */
  spinner: {
    width: 12,
    height: 12,
    borderRadius: 999,
    border: `1.5px solid ${border}`,
    borderTopColor: accent,
    animation: "molvis-nb-spin 0.7s linear infinite",
    boxSizing: "border-box" as const,
    flexShrink: 0,
  },
  // shared tokens for IconButton hover
  interactive,
  accent,
  muted,
  fg,
  // console (host panel surface — no hard-coded black)
  consoleHost: {
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column" as const,
    background: tokens.panel,
    color: fg,
  },
  xterm: {
    flex: 1,
    minHeight: 0,
    padding: 4,
  },
  // script dialog leftovers
  btn: (variant: "primary" | "ghost" | "danger" = "ghost") =>
    ({
      border: "none",
      background: "transparent",
      color:
        variant === "primary"
          ? accent
          : variant === "danger"
            ? danger
            : "inherit",
      borderRadius: 6,
      padding: "4px 8px",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
    }) as const,
  scriptBody: {
    display: "flex",
    flexDirection: "column" as const,
    height: "min(70vh, 640px)",
    minHeight: 320,
    background: tokens.panel,
    color: fg,
  },
  scriptEditor: {
    flex: 1,
    minHeight: 0,
  },
  monacoBox: {
    width: "100%",
    height: "100%",
    minHeight: 280,
  },
};
