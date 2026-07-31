import { useState } from "react";
import { defaultTempPoint } from "../../model/defaults";
import type { Ensemble, TempControlPoint, Thermostat } from "../../model/types";
import { css } from "../styles";
import { TempScheduleChart } from "../TempScheduleChart";

const ENSEMBLES: Ensemble[] = ["nve", "nvt", "npt"];
const THERMOSTATS: Thermostat[] = ["nose-hoover", "berendsen", "langevin"];

export function EquilibrationStep({
  tempPoints,
  onChange,
}: {
  tempPoints: TempControlPoint[];
  onChange: (next: TempControlPoint[]) => void;
}) {
  const [playToken, setPlayToken] = useState(0);

  const update = (index: number, patch: Partial<TempControlPoint>) => {
    onChange(tempPoints.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const remove = (index: number) => {
    if (tempPoints.length <= 2) return;
    onChange(tempPoints.filter((_, i) => i !== index));
  };

  const addPoint = () => {
    const last = tempPoints[tempPoints.length - 1];
    const step = (last?.step ?? 0) + 50_000;
    const temperature = last?.temperature ?? 300;
    onChange([
      ...tempPoints,
      defaultTempPoint({
        name: `Point ${tempPoints.length + 1}`,
        step,
        temperature,
        ensemble: last?.ensemble ?? "nvt",
        thermostat: last?.thermostat ?? "nose-hoover",
        tdamp: last?.tdamp ?? 100,
        pStart: last?.pStart,
        pStop: last?.pStop,
        pdamp: last?.pdamp,
      }),
    ]);
  };

  return (
    <div>
      <p style={css.hint}>
        Add <strong>调温点</strong> (step, T) to shape the temperature curve.
        molplot draws the polyline; each point after the first ends a segment
        with its own ensemble / thermostat. Use <em>Play schedule</em> to
        animate the playhead along the curve.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <button
          type="button"
          style={css.btn("ghost")}
          onClick={() => setPlayToken((n) => n + 1)}
        >
          Play schedule
        </button>
      </div>

      <TempScheduleChart tempPoints={tempPoints} playToken={playToken} />

      <div style={{ marginTop: 14 }}>
        {tempPoints.map((point, index) => {
          const isOrigin = index === 0;
          return (
            <div key={point.id} style={css.stageCard}>
              <div style={css.stageHead}>
                <strong style={{ fontSize: 13 }}>
                  {isOrigin
                    ? "Origin (t = 0)"
                    : `调温点 ${index}${point.name ? ` — ${point.name}` : ""}`}
                </strong>
                <button
                  type="button"
                  style={css.btn("danger")}
                  onClick={() => remove(index)}
                  disabled={tempPoints.length <= 2}
                >
                  Remove
                </button>
              </div>
              <div style={css.row}>
                <label style={css.field}>
                  <span style={css.label}>Name</span>
                  <input
                    style={css.input}
                    value={point.name ?? ""}
                    onChange={(e) => update(index, { name: e.target.value })}
                  />
                </label>
                <label style={css.field}>
                  <span style={css.label}>Step</span>
                  <input
                    style={css.input}
                    type="number"
                    value={point.step}
                    disabled={isOrigin}
                    onChange={(e) =>
                      update(index, { step: Number(e.target.value) })
                    }
                  />
                </label>
                <label style={css.field}>
                  <span style={css.label}>Temperature</span>
                  <input
                    style={css.input}
                    type="number"
                    step="any"
                    value={point.temperature}
                    onChange={(e) =>
                      update(index, {
                        temperature: Number(e.target.value),
                      })
                    }
                  />
                </label>
                {!isOrigin && (
                  <>
                    <label style={css.field}>
                      <span style={css.label}>Ensemble</span>
                      <select
                        style={css.input}
                        value={point.ensemble}
                        onChange={(e) =>
                          update(index, {
                            ensemble: e.target.value as Ensemble,
                          })
                        }
                      >
                        {ENSEMBLES.map((en) => (
                          <option key={en} value={en}>
                            {en.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    {point.ensemble !== "nve" && (
                      <label style={css.field}>
                        <span style={css.label}>Thermostat</span>
                        <select
                          style={css.input}
                          value={point.thermostat ?? "nose-hoover"}
                          onChange={(e) =>
                            update(index, {
                              thermostat: e.target.value as Thermostat,
                            })
                          }
                        >
                          {THERMOSTATS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {point.ensemble !== "nve" && (
                      <label style={css.field}>
                        <span style={css.label}>tdamp</span>
                        <input
                          style={css.input}
                          type="number"
                          step="any"
                          value={point.tdamp ?? ""}
                          onChange={(e) =>
                            update(index, {
                              tdamp:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                    {point.ensemble === "npt" && (
                      <>
                        <label style={css.field}>
                          <span style={css.label}>P start</span>
                          <input
                            style={css.input}
                            type="number"
                            step="any"
                            value={point.pStart ?? 1}
                            onChange={(e) =>
                              update(index, {
                                pStart: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label style={css.field}>
                          <span style={css.label}>P stop</span>
                          <input
                            style={css.input}
                            type="number"
                            step="any"
                            value={point.pStop ?? point.pStart ?? 1}
                            onChange={(e) =>
                              update(index, {
                                pStop: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label style={css.field}>
                          <span style={css.label}>pdamp</span>
                          <input
                            style={css.input}
                            type="number"
                            step="any"
                            value={point.pdamp ?? ""}
                            onChange={(e) =>
                              update(index, {
                                pdamp:
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        <button type="button" style={css.btn("primary")} onClick={addPoint}>
          添加调温点
        </button>
      </div>
    </div>
  );
}
