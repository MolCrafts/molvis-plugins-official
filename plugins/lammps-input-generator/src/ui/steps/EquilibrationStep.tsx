import { useState } from "react";
import { defaultTempPoint } from "../../model/defaults";
import type { Ensemble, LammpsUnits, TempControlPoint, Thermostat } from "../../model/types";
import { Select, SelectItem } from "../Select";
import { css } from "../styles";
import { TempScheduleChart } from "../TempScheduleChart";

const ENSEMBLES: { value: Ensemble; label: string; description: string }[] = [
  { value: "nve", label: "NVE", description: "Energy conserving" },
  { value: "nvt", label: "NVT", description: "Temperature controlled" },
  { value: "npt", label: "NPT", description: "Temperature + pressure" },
];
const THERMOSTATS: Thermostat[] = ["nose-hoover", "langevin", "berendsen"];
const STRIDE = 50_000;

export function EquilibrationStep({ tempPoints, units, onChange }: { tempPoints: TempControlPoint[]; units: LammpsUnits; onChange: (next: TempControlPoint[]) => void }) {
  const [playToken, setPlayToken] = useState(0);
  const update = (index: number, patch: Partial<TempControlPoint>) => onChange(tempPoints.map((point, i) => i === index ? { ...point, ...patch } : point));
  const remove = (index: number) => tempPoints.length > 2 && onChange(tempPoints.filter((_, i) => i !== index));
  const addPoint = () => {
    const last = tempPoints.at(-1);
    onChange([...tempPoints, defaultTempPoint(units, {
      name: `Stage ${tempPoints.length}`,
      step: (last?.step ?? 0) + STRIDE,
      temperature: last?.temperature,
      ensemble: "nvt",
    })]);
  };

  return (
    <div style={css.stack}>
      <p style={css.hint}>The first point sets the initial temperature. Each following row defines one run stage.</p>

      <div style={css.stageCard}>
        <div style={css.stageHead}><strong>Initial state</strong><span style={css.stageMeta}>step 0</span></div>
        <div style={css.grid2}>
          <label style={css.field}><span style={css.label}>Label</span><input style={css.input} value={tempPoints[0]?.name ?? ""} onChange={(e) => update(0, { name: e.target.value })} /></label>
          <label style={css.field}><span style={css.label}>Temperature</span><input style={css.input} type="number" step="any" value={tempPoints[0]?.temperature ?? 0} onChange={(e) => update(0, { temperature: Number(e.target.value) })} /></label>
        </div>
      </div>

      {tempPoints.slice(1).map((point, offset) => {
        const index = offset + 1;
        const previous = tempPoints[index - 1];
        return (
          <div key={point.id} style={css.stageCard}>
            <div style={css.stageHead}>
              <strong>Stage {index}</strong>
              <button type="button" style={css.removeIcon} disabled={tempPoints.length <= 2} onClick={() => remove(index)} aria-label={`Remove stage ${index}`} title="Remove">×</button>
            </div>

            <div style={css.ensemblePicker}>
              <label style={css.field}>
                <span style={css.label}>1. Ensemble</span>
                <Select value={point.ensemble} onValueChange={(value) => update(index, { ensemble: value as Ensemble })} ariaLabel={`Stage ${index} ensemble`}>
                  {ENSEMBLES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label} — {item.description}</SelectItem>)}
                </Select>
              </label>
            </div>

            <div style={css.grid3}>
              <label style={css.field}><span style={css.label}>Label</span><input style={css.input} value={point.name ?? ""} onChange={(e) => update(index, { name: e.target.value })} /></label>
              <label style={css.field}><span style={css.label}>End step</span><input style={css.input} type="number" min={previous.step} value={point.step} onChange={(e) => update(index, { step: Number(e.target.value) })} /></label>
              <label style={css.field}><span style={css.label}>Target temperature</span><input style={css.input} type="number" step="any" value={point.temperature} onChange={(e) => update(index, { temperature: Number(e.target.value) })} /></label>
            </div>

            {point.ensemble !== "nve" ? (
              <div style={css.detailPanel}>
                <span style={css.label}>2. Temperature control</span>
                <div style={css.grid3}>
                  <label style={css.field}><span style={css.label}>Thermostat</span><Select value={point.thermostat ?? "nose-hoover"} onValueChange={(value) => update(index, { thermostat: value as Thermostat })} ariaLabel={`Stage ${index} thermostat`}>{THERMOSTATS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</Select></label>
                  <label style={css.field}><span style={css.label}>Tdamp</span><input style={css.input} type="number" step="any" value={point.tdamp ?? ""} onChange={(e) => update(index, { tdamp: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
                  {point.thermostat === "langevin" ? <label style={css.field}><span style={css.label}>Random seed</span><input style={css.input} type="number" value={point.langevinSeed ?? ""} onChange={(e) => update(index, { langevinSeed: Number(e.target.value) })} /></label> : <div />}
                </div>
              </div>
            ) : null}

            {point.ensemble === "npt" ? (
              <div style={css.detailPanel}>
                <span style={css.label}>3. Isotropic pressure control</span>
                <div style={css.grid3}>
                  <label style={css.field}><span style={css.label}>Start pressure</span><input style={css.input} type="number" step="any" value={point.pStart ?? 1} onChange={(e) => update(index, { pStart: Number(e.target.value) })} /></label>
                  <label style={css.field}><span style={css.label}>Target pressure</span><input style={css.input} type="number" step="any" value={point.pStop ?? point.pStart ?? 1} onChange={(e) => update(index, { pStop: Number(e.target.value) })} /></label>
                  <label style={css.field}><span style={css.label}>Pdamp</span><input style={css.input} type="number" step="any" value={point.pdamp ?? ""} onChange={(e) => update(index, { pdamp: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      <button type="button" style={css.btn("ghost")} onClick={addPoint}>+ Add stage</button>
      <div style={css.chartToolbar}>
        <strong style={css.subsectionTitle}>Temperature schedule</strong>
        <button type="button" style={css.btn("ghost")} onClick={() => setPlayToken((n) => n + 1)}>Play</button>
      </div>
      <TempScheduleChart tempPoints={tempPoints} playToken={playToken} />
    </div>
  );
}
