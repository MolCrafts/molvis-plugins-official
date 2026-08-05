import { defaultMinimize } from "../../model/defaults";
import type { MinimizeConfig } from "../../model/types";
import { css } from "../styles";
import { Select, SelectItem } from "../Select";
import { Checkbox } from "@/components/ui/checkbox";

const MIN_STYLES = ["cg", "hftn", "sd", "quickmin", "fire"];

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
        <Checkbox checked={enabled} onCheckedChange={(checked) => onChange(checked === true ? defaultMinimize() : null)} />
        Run energy minimization before equilibration
      </label>
      {enabled && (
        <>
          <p style={css.hint}>
            Emits <code>min_style</code> + <code>minimize</code> before eq
            stages.
          </p>
          <div style={css.minimizeGrid}>
            <label style={css.field}>
              <span style={css.label}>min_style</span>
              <Select value={m.minStyle} onValueChange={(minStyle) => onChange({ ...m, minStyle })} ariaLabel="Minimize style">
                {MIN_STYLES.map((style) => <SelectItem key={style} value={style}>{style}</SelectItem>)}
              </Select>
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
          {m.minStyle !== "hftn" ? (
            <div style={css.detailPanel}>
              <span style={css.label}>Style parameters (min_modify)</span>
              <div style={css.grid3}>
                <label style={css.field}><span style={css.label}>dmax</span><input style={css.input} type="number" step="any" placeholder="LAMMPS default" value={m.dmax ?? ""} onChange={(e) => onChange({ ...m, dmax: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
                <label style={css.field}><span style={css.label}>Force norm</span><Select value={m.norm ?? "two"} onValueChange={(norm) => onChange({ ...m, norm: norm as MinimizeConfig["norm"] })} ariaLabel="Minimize force norm">{["two", "max", "inf"].map((norm) => <SelectItem key={norm} value={norm}>{norm}</SelectItem>)}</Select></label>
                {m.minStyle === "fire" ? <label style={css.field}><span style={css.label}>Integrator</span><Select value={m.fireIntegrator ?? "eulerimplicit"} onValueChange={(fireIntegrator) => onChange({ ...m, fireIntegrator: fireIntegrator as MinimizeConfig["fireIntegrator"] })} ariaLabel="FIRE integrator">{["eulerimplicit", "verlet", "leapfrog"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</Select></label> : <div />}
              </div>
              {m.minStyle === "fire" ? <label style={{ ...css.field, maxWidth: 160 }}><span style={css.label}>Maximum adaptive timestep (tmax)</span><input style={css.input} type="number" step="any" placeholder="10" value={m.fireTmax ?? ""} onChange={(e) => onChange({ ...m, fireTmax: e.target.value === "" ? undefined : Number(e.target.value) })} /></label> : null}
            </div>
          ) : <p style={css.hint}>HFTN is not affected by min_modify.</p>}
        </>
      )}
    </div>
  );
}
