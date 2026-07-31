/** Inline styles for the wizard (plugins cannot use host Tailwind). */
export const css = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 10000,
    background: "rgba(10, 16, 14, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    color: "var(--molvis-fg, #14271d)",
  },
  panel: {
    width: "min(960px, 100%)",
    maxHeight: "min(920px, 96vh)",
    background: "var(--molvis-surface, #f7faf8)",
    borderRadius: 12,
    boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    border: "1px solid var(--molvis-border, #cad5ce)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid var(--molvis-border, #cad5ce)",
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 650,
    letterSpacing: "-0.01em",
  },
  steps: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
    padding: "10px 18px",
    borderBottom: "1px solid var(--molvis-border, #e2eae5)",
    background: "var(--molvis-muted, #eef3f0)",
  },
  stepBtn: (active: boolean, done: boolean) =>
    ({
      border: "none",
      background: active
        ? "var(--molvis-accent, #1f6f4a)"
        : done
          ? "rgba(31,111,74,0.12)"
          : "transparent",
      color: active
        ? "#fff"
        : "var(--molvis-fg, #14271d)",
      borderRadius: 999,
      padding: "5px 11px",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      opacity: active || done ? 1 : 0.7,
    }) as const,
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
    borderTop: "1px solid var(--molvis-border, #cad5ce)",
    background: "var(--molvis-muted, #eef3f0)",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
    marginBottom: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    fontSize: 12,
  },
  label: {
    fontWeight: 600,
    opacity: 0.78,
    fontSize: 11,
    letterSpacing: "0.02em",
    textTransform: "uppercase" as const,
  },
  input: {
    border: "1px solid var(--molvis-border, #cad5ce)",
    borderRadius: 6,
    padding: "7px 9px",
    fontSize: 13,
    background: "#fff",
    color: "inherit",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  textarea: {
    border: "1px solid var(--molvis-border, #cad5ce)",
    borderRadius: 6,
    padding: "8px 9px",
    fontSize: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    background: "#fff",
    color: "inherit",
    width: "100%",
    boxSizing: "border-box" as const,
    minHeight: 72,
    resize: "vertical" as const,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 650,
    margin: "0 0 8px",
  },
  hint: {
    fontSize: 12,
    opacity: 0.72,
    margin: "0 0 10px",
    lineHeight: 1.45,
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
            ? "transparent"
            : "var(--molvis-surface, #fff)",
      color:
        variant === "primary"
          ? "#fff"
          : variant === "danger"
            ? "#a12b2b"
            : "inherit",
      borderRadius: 8,
      padding: "7px 14px",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
    }) as const,
  stageCard: {
    border: "1px solid var(--molvis-border, #cad5ce)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    background: "#fff",
  },
  stageHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  chartHost: {
    width: "100%",
    height: 220,
    border: "1px solid var(--molvis-border, #cad5ce)",
    borderRadius: 8,
    background: "#fff",
    marginTop: 8,
  },
  pre: {
    margin: 0,
    padding: 12,
    borderRadius: 8,
    background: "#0f1a14",
    color: "#d7e8dc",
    fontSize: 12,
    lineHeight: 1.45,
    overflow: "auto",
    maxHeight: 420,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    marginBottom: 8,
  },
};
