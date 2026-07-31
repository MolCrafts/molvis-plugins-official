import { defaultMinimize } from "../../model/defaults";
import type { MinimizeConfig } from "../../model/types";
import { css } from "../styles";

export function MinimizeStep({
  value,
  onChange,
}: {
  value: MinimizeConfig | null;
  onChange: (next: MinimizeConfig | null) => void;
}) {
  const enabled = value != null;
  const m = value ?? defaultMinimize();

  return (
    <div>
      <label style={css.checkRow}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? defaultMinimize() : null)}
        />
        Run energy minimization before equilibration
      </label>
      {enabled && (
        <>
          <p style={css.hint}>
            Emits <code>min_style</code> + <code>minimize</code> before eq
            stages.
          </p>
          <div style={css.row}>
            <label style={css.field}>
              <span style={css.label}>min_style</span>
              <input
                style={css.input}
                value={m.minStyle}
                onChange={(e) => onChange({ ...m, minStyle: e.target.value })}
              />
            </label>
            <label style={css.field}>
              <span style={css.label}>etol</span>
              <input
                style={css.input}
                type="number"
                step="any"
                value={m.etol}
                onChange={(e) => onChange({ ...m, etol: Number(e.target.value) })}
              />
            </label>
            <label style={css.field}>
              <span style={css.label}>ftol</span>
              <input
                style={css.input}
                type="number"
                step="any"
                value={m.ftol}
                onChange={(e) => onChange({ ...m, ftol: Number(e.target.value) })}
              />
            </label>
            <label style={css.field}>
              <span style={css.label}>maxiter</span>
              <input
                style={css.input}
                type="number"
                value={m.maxiter}
                onChange={(e) =>
                  onChange({ ...m, maxiter: Number(e.target.value) })
                }
              />
            </label>
            <label style={css.field}>
              <span style={css.label}>maxeval</span>
              <input
                style={css.input}
                type="number"
                value={m.maxeval}
                onChange={(e) =>
                  onChange({ ...m, maxeval: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
