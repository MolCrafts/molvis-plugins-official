import { withUnits } from "../../model/defaults";
import type { BoundaryFlag, InitConfig, LammpsUnits } from "../../model/types";
import { UNIT_SYSTEM_DEFAULTS, unitDefaults } from "../../model/unit_systems";
import { SettingsRow, SettingsSection } from "../SettingsSection";
import { Select, SelectItem } from "../Select";
import { css } from "../styles";

const UNITS = Object.keys(UNIT_SYSTEM_DEFAULTS) as LammpsUnits[];
const BOUNDARY: BoundaryFlag[] = ["p", "f", "s", "m"];

export function SystemSection({
  value,
  onChange,
}: {
  value: InitConfig;
  onChange: (next: InitConfig) => void;
}) {
  const set = <K extends keyof InitConfig>(key: K, v: InitConfig[K]) => {
    onChange({ ...value, [key]: v });
  };

  const units = unitDefaults(value.units);

  return (
    <SettingsSection
      id="system"
      title="System"
      description="Global units, atom style, box boundary, topology file, and MD timestep."
    >
      <SettingsRow label="Units">
        <Select
          value={value.units}
          // Switching unit system re-derives timestep and neighbor skin:
          // those numbers do not carry over (1.0 is 1 fs under `real` but
          // 1 ps under `metal`).
          onValueChange={(next) =>
            onChange(withUnits(value, next as LammpsUnits))
          }
          ariaLabel="Unit system"
        >
          {UNITS.map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </Select>
      </SettingsRow>
      <SettingsRow label="Atom style">
        <input
          style={css.inputNarrow}
          value={value.atomStyle}
          onChange={(e) => set("atomStyle", e.target.value)}
        />
      </SettingsRow>
      <SettingsRow label="Data file">
        <input
          style={css.inputWide}
          value={value.dataFile}
          onChange={(e) => set("dataFile", e.target.value)}
        />
      </SettingsRow>
      <SettingsRow label="Boundary">
        {(["x", "y", "z"] as const).map((axis, i) => (
          <label key={axis} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ opacity: 0.7 }}>{axis}</span>
            <Select
              value={value.boundary[i]}
              onValueChange={(selected) => {
                const next = [...value.boundary] as InitConfig["boundary"];
                next[i] = selected as BoundaryFlag;
                set("boundary", next);
              }}
              ariaLabel={`${axis} boundary`}
              className="w-16"
            >
              {BOUNDARY.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </Select>
          </label>
        ))}
      </SettingsRow>
      <SettingsRow label={`Timestep (${units.timeUnit})`}>
        <input
          style={css.inputNarrow}
          type="number"
          step="any"
          value={value.timestep}
          onChange={(e) => set("timestep", Number(e.target.value))}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
