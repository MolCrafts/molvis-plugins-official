import type { InitConfig } from "../../model/types";
import { SettingsRow, SettingsSection } from "../SettingsSection";
import { Select, SelectItem } from "../Select";
import { css } from "../styles";

export function ThermoSection({
  value,
  onChange,
}: {
  value: InitConfig;
  onChange: (next: InitConfig) => void;
}) {
  const [style, ...args] = value.thermoStyle.trim().split(/\s+/);
  const setStyle = (next: string) => onChange({
    ...value,
    thermoStyle: next === "custom"
      ? `custom ${args.length > 0 ? args.join(" ") : "step temp pe ke etotal press vol"}`
      : next,
  });

  return (
    <SettingsSection
      id="thermo"
      title="Thermo"
      description="Thermodynamic output interval and style (thermo / thermo_style)."
    >
      <div style={css.grid2}>
        <label style={css.field}>
          <span style={css.label}>Style</span>
          <Select value={style || "custom"} onValueChange={setStyle} ariaLabel="Thermo style">
            {["custom", "one", "multi", "yaml"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </Select>
        </label>
        <label style={css.field}>
          <span style={css.label}>Output every</span>
          <input style={css.input} type="number" min={1} value={value.thermoEvery} onChange={(e) => onChange({ ...value, thermoEvery: Number(e.target.value) })} />
        </label>
      </div>
      {style === "custom" ? <SettingsRow label="Keywords" stacked><input style={css.input} value={args.join(" ")} onChange={(e) => onChange({ ...value, thermoStyle: `custom ${e.target.value}` })} /></SettingsRow> : null}
    </SettingsSection>
  );
}
