import type { BoundaryFlag, InitConfig, LammpsUnits } from "../../model/types";
import { css } from "../styles";

const UNITS: LammpsUnits[] = [
  "real",
  "metal",
  "lj",
  "si",
  "cgs",
  "electron",
  "micro",
  "nano",
];
const BOUNDARY: BoundaryFlag[] = ["p", "f", "s", "m"];

export function InitStep({
  value,
  onChange,
}: {
  value: InitConfig;
  onChange: (next: InitConfig) => void;
}) {
  const set = <K extends keyof InitConfig>(key: K, v: InitConfig[K]) => {
    onChange({ ...value, [key]: v });
  };
  const ff = value.forceField;

  return (
    <div>
      <section style={css.section}>
        <h3 style={css.sectionTitle}>System</h3>
        <div style={css.row}>
          <label style={css.field}>
            <span style={css.label}>Units</span>
            <select
              style={css.input}
              value={value.units}
              onChange={(e) => set("units", e.target.value as LammpsUnits)}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label style={css.field}>
            <span style={css.label}>Atom style</span>
            <input
              style={css.input}
              value={value.atomStyle}
              onChange={(e) => set("atomStyle", e.target.value)}
            />
          </label>
          <label style={css.field}>
            <span style={css.label}>Data file</span>
            <input
              style={css.input}
              value={value.dataFile}
              onChange={(e) => set("dataFile", e.target.value)}
            />
          </label>
        </div>
        <div style={css.row}>
          {(["x", "y", "z"] as const).map((axis, i) => (
            <label key={axis} style={css.field}>
              <span style={css.label}>Boundary {axis}</span>
              <select
                style={css.input}
                value={value.boundary[i]}
                onChange={(e) => {
                  const next = [...value.boundary] as InitConfig["boundary"];
                  next[i] = e.target.value as BoundaryFlag;
                  set("boundary", next);
                }}
              >
                {BOUNDARY.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section style={css.section}>
        <h3 style={css.sectionTitle}>Force field (placeholders)</h3>
        <p style={css.hint}>
          Stubs so the script structure is complete — replace coefficients for
          your topology. Optional bond/angle/… lines stay commented unless you
          add them under extra lines.
        </p>
        <div style={css.row}>
          <label style={{ ...css.field, gridColumn: "1 / -1" }}>
            <span style={css.label}>pair_style</span>
            <input
              style={css.input}
              value={ff.pairStyle}
              onChange={(e) =>
                set("forceField", { ...ff, pairStyle: e.target.value })
              }
            />
          </label>
          <label style={{ ...css.field, gridColumn: "1 / -1" }}>
            <span style={css.label}>pair_coeff</span>
            <input
              style={css.input}
              value={ff.pairCoeff}
              onChange={(e) =>
                set("forceField", { ...ff, pairCoeff: e.target.value })
              }
            />
          </label>
          <label style={{ ...css.field, gridColumn: "1 / -1" }}>
            <span style={css.label}>Extra FF lines</span>
            <textarea
              style={css.textarea}
              value={ff.extraLines}
              placeholder={"# bond_style harmonic\n# bond_coeff 1 …"}
              onChange={(e) =>
                set("forceField", { ...ff, extraLines: e.target.value })
              }
            />
          </label>
        </div>
        <label style={css.checkRow}>
          <input
            type="checkbox"
            checked={ff.includeCommentedStubs}
            onChange={(e) =>
              set("forceField", {
                ...ff,
                includeCommentedStubs: e.target.checked,
              })
            }
          />
          Include commented bond/angle/dihedral/kspace stubs
        </label>
      </section>

      <section style={css.section}>
        <h3 style={css.sectionTitle}>Control</h3>
        <div style={css.row}>
          <label style={css.field}>
            <span style={css.label}>Timestep</span>
            <input
              style={css.input}
              type="number"
              step="any"
              value={value.timestep}
              onChange={(e) => set("timestep", Number(e.target.value))}
            />
          </label>
          <label style={css.field}>
            <span style={css.label}>Thermo every</span>
            <input
              style={css.input}
              type="number"
              value={value.thermoEvery}
              onChange={(e) => set("thermoEvery", Number(e.target.value))}
            />
          </label>
          <label style={css.field}>
            <span style={css.label}>Neighbor skin</span>
            <input
              style={css.input}
              type="number"
              step="any"
              value={value.neighborSkin}
              onChange={(e) => set("neighborSkin", Number(e.target.value))}
            />
          </label>
        </div>
        <label style={{ ...css.field, marginBottom: 8 }}>
          <span style={css.label}>Thermo style</span>
          <input
            style={css.input}
            value={value.thermoStyle}
            onChange={(e) => set("thermoStyle", e.target.value)}
          />
        </label>
        <label style={css.checkRow}>
          <input
            type="checkbox"
            checked={value.neighborCheck}
            onChange={(e) => set("neighborCheck", e.target.checked)}
          />
          Neighbor check yes
        </label>
      </section>
    </div>
  );
}
