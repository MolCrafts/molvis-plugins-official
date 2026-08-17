import type { InitConfig, NeighborStyle } from "../../model/types";
import { SettingsRow, SettingsSection } from "../SettingsSection";
import { Select, SelectItem } from "../Select";
import { css } from "../styles";
import { Checkbox } from "@molcrafts/molvis-plugin/ui";

const STYLES: NeighborStyle[] = ["bin", "nsq", "multi"];

export function NeighborSection({ value, onChange }: { value: InitConfig; onChange: (next: InitConfig) => void }) {
  const n = value.neighbor!;
  const set = <K extends keyof typeof n>(key: K, next: (typeof n)[K]) =>
    onChange({ ...value, neighbor: { ...n, [key]: next } });
  const delayInvalid = n.every < 1 || n.delay < 0 || n.delay % n.every !== 0;
  const pageInvalid = n.one < 1 || n.page < n.one * 10;

  return (
    <SettingsSection
      id="neighbor"
      title="Neighbor list"
      description="Build method, skin distance, rebuild policy, and neighbor storage limits. LAMMPS defaults are shown explicitly."
    >
      <div style={css.grid2}>
        <label style={css.field}>
          <span style={css.label}>Build style</span>
          <Select value={n.style} onValueChange={(v) => set("style", v as NeighborStyle)} ariaLabel="Neighbor build style">
            {STYLES.map((style) => <SelectItem key={style} value={style}>{style}</SelectItem>)}
          </Select>
        </label>
        <label style={css.field}>
          <span style={css.label}>Skin distance</span>
          <input style={css.input} type="number" min={0} step="any" value={n.skin} onChange={(e) => set("skin", Number(e.target.value))} />
        </label>
      </div>

      <div style={css.subsection}>
        <strong style={css.subsectionTitle}>Rebuild policy</strong>
        <div style={css.grid3}>
          <label style={css.field}><span style={css.label}>Every</span><input style={css.input} type="number" min={1} value={n.every} onChange={(e) => set("every", Number(e.target.value))} /></label>
          <label style={css.field}><span style={css.label}>Delay</span><input style={css.input} type="number" min={0} value={n.delay} onChange={(e) => set("delay", Number(e.target.value))} /></label>
          <div style={css.toggleStack}>
            <label style={css.checkRow}><Checkbox checked={n.check} onCheckedChange={(checked) => set("check", checked === true)} /> Check displacement</label>
            <label style={css.checkRow}><Checkbox checked={n.once} onCheckedChange={(checked) => set("once", checked === true)} /> Build once</label>
          </div>
        </div>
        {delayInvalid ? <p style={css.error}>Delay must be a non-negative multiple of Every.</p> : null}
      </div>

      <div style={css.subsection}>
        <strong style={css.subsectionTitle}>Storage & bins</strong>
        <div style={css.grid3}>
          <label style={css.field}><span style={css.label}>Page</span><input style={css.input} type="number" min={1} value={n.page} onChange={(e) => set("page", Number(e.target.value))} /></label>
          <label style={css.field}><span style={css.label}>One</span><input style={css.input} type="number" min={1} value={n.one} onChange={(e) => set("one", Number(e.target.value))} /></label>
          <label style={css.field}><span style={css.label}>Bin size (0 = auto)</span><input style={css.input} type="number" min={0} step="any" value={n.binsize} onChange={(e) => set("binsize", Number(e.target.value))} /></label>
        </div>
        {pageInvalid ? <p style={css.error}>Page must be at least 10 × One.</p> : null}
      </div>
    </SettingsSection>
  );
}
