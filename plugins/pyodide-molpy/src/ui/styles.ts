/** Inline styles — plugins cannot rely on host Tailwind. */
export const css = {
  root: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    minHeight: 0,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize: 12,
    color: "var(--molvis-fg, #14271d)",
    background: "var(--molvis-surface, #f7faf8)",
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
    alignItems: "center",
    padding: "6px 8px",
    borderBottom: "1px solid var(--molvis-border, #cad5ce)",
    background: "var(--molvis-muted, #eef3f0)",
    flexShrink: 0,
  },
  btn: (variant: "primary" | "ghost" | "danger" = "ghost") =>
    ({
      border:
        variant === "ghost"
          ? "1px solid var(--molvis-border, #cad5ce)"
          : "none",
      background:
        variant === "primary"
          ? "var(--molvis-accent, #1f6f4a)"
          : variant === "danger"
            ? "rgba(180,40,40,0.12)"
            : "transparent",
      color:
        variant === "primary"
          ? "#fff"
          : "var(--molvis-fg, #14271d)",
      borderRadius: 6,
      padding: "4px 10px",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
    }) as const,
  status: {
    marginLeft: "auto",
    fontSize: 11,
    color: "var(--molvis-muted-fg, #5a6b62)",
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
  },
  cells: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    padding: 8,
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  cell: {
    border: "1px solid var(--molvis-border, #cad5ce)",
    borderRadius: 8,
    overflow: "hidden",
    background: "var(--molvis-surface, #fff)",
  },
  cellHead: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    background: "var(--molvis-muted, #eef3f0)",
    borderBottom: "1px solid var(--molvis-border, #e2eae5)",
    fontSize: 11,
    fontWeight: 600,
  },
  textarea: {
    width: "100%",
    minHeight: 72,
    border: "none",
    resize: "vertical" as const,
    padding: 8,
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: 12,
    lineHeight: 1.45,
    background: "transparent",
    color: "inherit",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  out: {
    borderTop: "1px solid var(--molvis-border, #e2eae5)",
    padding: 8,
    whiteSpace: "pre-wrap" as const,
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: 11,
    background: "rgba(0,0,0,0.03)",
    maxHeight: 160,
    overflow: "auto",
  },
  consoleHost: {
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column" as const,
  },
  consoleBar: {
    display: "flex",
    gap: 6,
    padding: "4px 8px",
    borderBottom: "1px solid var(--molvis-border, #cad5ce)",
    flexShrink: 0,
  },
  xterm: {
    flex: 1,
    minHeight: 0,
    padding: 4,
  },
  scriptBody: {
    display: "flex",
    flexDirection: "column" as const,
    height: "min(70vh, 640px)",
    minHeight: 320,
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
