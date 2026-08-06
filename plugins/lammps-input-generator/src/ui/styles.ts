/**
 * Inline styles matching MolVis Settings dialog density
 * (plugins cannot use host Tailwind).
 *
 * Token names match host `page/src/styles/tailwind.css` (`--molvis-*`).
 */
import { FONT, statusToken, token } from "@molcrafts/molvis-plugin";

// One vendored token table for every plugin. The previous local copies chained
// through `var(--background)` / `var(--border)`, which the host never defines,
// so they always fell through to a hardcoded light-theme hex.
const border = token("border");
const panel = token("panel");
const panelRaised = token("panelRaised");
const fg = token("foreground");
const mutedFg = token("mutedForeground");
const accent = token("accent");
const accentFg = token("accentForeground");
const accentSoft = `color-mix(in oklab, ${accent} 14%, transparent)`;
const failed = statusToken("failed");
const scrim = token("scrim");
const shadow = token("shadowOverlay");
const inputBg = "transparent";
const bodySize = "var(--molvis-ui-font-size, var(--text-body, 0.8125rem))";
const labelSize = "var(--text-label, 0.75rem)";
const controlSize = "var(--text-body-lg, 0.875rem)";

export const css = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 10000,
    background: scrim,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    fontFamily: FONT.sans,
    color: fg,
  },
  panel: {
    width: "min(46rem, calc(100vw - 2rem))",
    height: "min(85vh, 40rem)",
    background: panel,
    borderRadius: 10,
    boxShadow: shadow,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    border: `1px solid ${border}`,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 18px",
    borderBottom: `1px solid ${border}`,
    gap: 12,
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 650,
    letterSpacing: "-0.01em",
  },
  bodyRow: {
    display: "flex",
    width: "100%",
    height: "min(72vh, 42rem)",
    minHeight: 0,
    overflow: "hidden",
    fontFamily: FONT.sans,
    fontSize: bodySize,
    lineHeight: 1.4,
    color: fg,
    background: "transparent",
  },
  rail: {
    width: 148,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
    padding: "10px 8px",
    overflowY: "auto" as const,
    borderRight: `1px solid ${border}`,
    background: "transparent",
  },
  railBtn: (active: boolean) =>
    ({
      display: "flex",
      width: "100%",
      alignItems: "center",
      border: "none",
      background: "transparent",
      color: active ? accent : mutedFg,
      borderRadius: 4,
      padding: "7px 8px 7px 10px",
      boxShadow: active ? `inset 2px 0 0 ${accent}` : "none",
      fontSize: controlSize,
      fontWeight: active ? 600 : 500,
      cursor: "pointer",
      textAlign: "left" as const,
    }) as const,
  scroll: {
    minWidth: 0,
    flex: 1,
    overflowY: "auto" as const,
    overscrollBehavior: "contain" as const,
  },
  page: {
    width: "100%",
    maxWidth: 680,
    padding: "0 20px 24px",
    boxSizing: "border-box" as const,
  },
  sectionWrap: {
    borderBottom: `1px solid ${border}`,
    padding: "16px 0",
  },
  sectionWrapLast: {
    padding: "16px 0 4px",
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  sectionHeader: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    marginBottom: 2,
  },
  sectionTitle: {
    margin: 0,
    fontSize: bodySize,
    fontWeight: 650,
    letterSpacing: "-0.01em",
  },
  sectionDesc: {
    margin: 0,
    fontSize: labelSize,
    lineHeight: 1.4,
    color: mutedFg,
    maxWidth: "42rem",
  },
  settingsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 26,
  },
  settingsLabel: {
    fontSize: labelSize,
    color: mutedFg,
    flexShrink: 0,
  },
  settingsControl: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap" as const,
    justifyContent: "flex-end",
    minWidth: 0,
    flex: 1,
  },
  stack: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  subsection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 5,
    paddingTop: 6,
    borderTop: `1px solid ${border}`,
  },
  subsectionTitle: {
    fontSize: labelSize,
    fontWeight: 600,
  },
  toggleStack: {
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    gap: 6,
  },
  error: {
    margin: 0,
    color: failed,
    fontSize: labelSize,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    fontSize: controlSize,
    minWidth: 0,
  },
  label: {
    fontWeight: 500,
    color: mutedFg,
    fontSize: labelSize,
  },
  input: {
    border: `1px solid ${border}`,
    borderRadius: 4,
    minHeight: 28,
    padding: "3px 8px",
    fontSize: controlSize,
    background: inputBg,
    color: "inherit",
    width: "100%",
    boxSizing: "border-box" as const,
    minWidth: 0,
  },
  inputNarrow: {
    border: `1px solid ${border}`,
    borderRadius: 4,
    minHeight: 28,
    padding: "3px 8px",
    fontSize: controlSize,
    background: inputBg,
    color: "inherit",
    width: 120,
    boxSizing: "border-box" as const,
  },
  inputWide: {
    border: `1px solid ${border}`,
    borderRadius: 4,
    minHeight: 28,
    padding: "3px 8px",
    fontSize: controlSize,
    background: inputBg,
    color: "inherit",
    width: "min(100%, 22rem)",
    boxSizing: "border-box" as const,
  },
  select: {
    border: `1px solid ${border}`,
    borderRadius: 4,
    minHeight: 28,
    padding: "3px 8px",
    fontSize: controlSize,
    background: inputBg,
    color: "inherit",
    maxWidth: "100%",
  },
  textarea: {
    border: `1px solid ${border}`,
    borderRadius: 6,
    padding: "8px 9px",
    fontSize: controlSize,
    fontFamily: FONT.mono,
    background: inputBg,
    color: "inherit",
    width: "100%",
    boxSizing: "border-box" as const,
    minHeight: 72,
    resize: "vertical" as const,
  },
  hint: {
    fontSize: labelSize,
    opacity: 0.72,
    margin: 0,
    lineHeight: 1.45,
  },
  btn: (variant: "primary" | "ghost" | "danger" = "ghost") =>
    ({
      border: variant === "ghost" ? `1px solid ${border}` : "none",
      background:
        variant === "primary"
          ? accent
          : variant === "danger"
            ? "transparent"
            : "transparent",
      color:
        variant === "primary"
          ? accentFg
          : variant === "danger"
            ? failed
            : "inherit",
      borderRadius: 4,
      minHeight: 28,
      padding: "3px 10px",
      fontSize: bodySize,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap" as const,
    }) as const,
  btnSm: {
    border: `1px solid ${border}`,
    background: "transparent",
    color: "inherit",
    borderRadius: 4,
    minHeight: 28,
    padding: "3px 10px",
    fontSize: bodySize,
    fontWeight: 600,
    cursor: "pointer",
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: bodySize,
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  listRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  commandRow: {
    display: "grid",
    gridTemplateColumns: "108px minmax(0, 1fr) 24px",
    alignItems: "center",
    gap: 8,
    minHeight: 26,
  },
  commandPrefix: {
    fontFamily: FONT.mono,
    fontSize: bodySize,
    color: fg,
    whiteSpace: "nowrap" as const,
  },
  commandArgs: {
    width: "100%",
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    color: fg,
    fontFamily: FONT.mono,
    fontSize: bodySize,
    padding: "3px 0",
  },
  removeIcon: {
    width: 24,
    height: 24,
    padding: 0,
    border: "none",
    borderRadius: 4,
    background: "transparent",
    color: mutedFg,
    fontSize: 17,
    lineHeight: 1,
    cursor: "pointer",
  },
  listInput: {
    border: `1px solid ${border}`,
    borderRadius: 6,
    padding: "5px 8px",
    fontSize: bodySize,
    fontFamily: FONT.mono,
    background: inputBg,
    color: "inherit",
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box" as const,
  },
  emptyList: {
    fontSize: labelSize,
    opacity: 0.65,
    padding: "6px 0",
  },
  addBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  stageCard: {
    border: "none",
    borderTop: `1px solid ${border}`,
    borderRadius: 0,
    padding: "8px 0 0",
    marginBottom: 4,
    background: "transparent",
  },
  stageHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  stageMeta: { fontSize: labelSize, color: mutedFg },
  chartToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  ensemblePicker: {
    maxWidth: 300,
    marginBottom: 10,
  },
  detailPanel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 5,
    marginTop: 6,
    padding: "6px 10px",
    borderLeft: `2px solid ${border}`,
    background: `color-mix(in oklab, ${panelRaised} 55%, transparent)`,
  },
  chartHost: {
    width: "100%",
    height: 170,
    border: `1px solid ${border}`,
    borderRadius: 4,
    background: "transparent",
    marginTop: 8,
  },
  pre: {
    margin: 0,
    padding: 12,
    borderRadius: 4,
    // Code block uses panel-raised (not hard-coded black).
    background: panelRaised,
    color: fg,
    border: `1px solid ${border}`,
    fontSize: bodySize,
    lineHeight: 1.45,
    overflow: "auto",
    maxHeight: 420,
    fontFamily: FONT.mono,
  },
  // legacy aliases used by older step components
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
    marginBottom: 12,
  },
  minimizeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(88px, 1fr))",
    gap: 8,
    marginTop: 6,
  },
  body: {
    padding: "16px 18px",
    overflow: "auto",
    flex: 1,
    minHeight: 0,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "12px 18px",
    borderTop: `1px solid ${border}`,
    background: panelRaised,
  },
  steps: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
    padding: "10px 18px",
    borderBottom: `1px solid ${border}`,
    background: panelRaised,
  },
  stepBtn: (active: boolean, done: boolean) =>
    ({
      border: "none",
      background: active ? accent : done ? accentSoft : "transparent",
      color: active ? accentFg : fg,
      borderRadius: 999,
      padding: "5px 11px",
      fontSize: bodySize,
      fontWeight: 600,
      cursor: "pointer",
      opacity: active || done ? 1 : 0.7,
    }) as const,
};
