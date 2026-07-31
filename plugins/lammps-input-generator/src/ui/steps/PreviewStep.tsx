import { css } from "../styles";

export function PreviewStep({
  script,
  onCopy,
  onDownload,
}: {
  script: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div>
      <p style={css.hint}>
        Review the generated input. Force-field lines are placeholders —
        adjust pair_coeff (and uncomment stubs) before production runs.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button type="button" style={css.btn("primary")} onClick={onCopy}>
          Copy
        </button>
        <button type="button" style={css.btn("ghost")} onClick={onDownload}>
          Download in.eq
        </button>
      </div>
      <pre style={css.pre}>{script}</pre>
    </div>
  );
}
