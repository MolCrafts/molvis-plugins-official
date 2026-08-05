import { useState } from "react";
import { makeFfLine } from "../../model/defaults";
import { FORCE_FIELD_PRESETS, presetByKind } from "../../model/ff_presets";
import type { ForceFieldPlaceholders } from "../../model/types";
import { SettingsRow, SettingsSection } from "../SettingsSection";
import { Select, SelectItem } from "../Select";
import { css } from "../styles";

export function ForceFieldSection({
  value,
  onChange,
}: {
  value: ForceFieldPlaceholders;
  onChange: (next: ForceFieldPlaceholders) => void;
}) {
  const [pick, setPick] = useState("pair_style");

  const addLine = () => {
    const preset = presetByKind(pick) ?? FORCE_FIELD_PRESETS[0];
    const text =
      preset.kind === "custom"
        ? ""
        : preset.text;
    onChange({
      ...value,
      lines: [...value.lines, makeFfLine({ text, kind: preset.kind })],
    });
  };

  const updateLine = (id: string, text: string) => {
    onChange({
      ...value,
      lines: value.lines.map((row) =>
        row.id === id ? { ...row, text } : row,
      ),
    });
  };

  const removeLine = (id: string) => {
    onChange({
      ...value,
      lines: value.lines.filter((row) => row.id !== id),
    });
  };

  const commandArgs = (text: string, kind: string) => {
    const trimmed = text.trimStart();
    return trimmed.startsWith(kind) ? trimmed.slice(kind.length).trimStart() : trimmed;
  };

  return (
    <SettingsSection
      id="forcefield"
      title="Force field"
      description="Ordered LAMMPS force-field commands. Add pair, bonded, long-range, or custom commands in script order."
    >
      <SettingsRow label="Commands" stacked>
        {value.lines.length === 0 ? (
          <p style={css.emptyList}>
            No force-field commands yet.
          </p>
        ) : (
          <div style={css.list}>
            {value.lines.map((row) => (
              <div key={row.id} style={css.commandRow}>
                <code style={css.commandPrefix}>{row.kind === "custom" ? "" : row.kind}</code>
                <input
                  style={css.commandArgs}
                  value={commandArgs(row.text, row.kind)}
                  placeholder={
                    row.kind === "custom"
                      ? "custom LAMMPS line…"
                      : "arguments…"
                  }
                  onChange={(e) => updateLine(row.id, row.kind === "custom" ? e.target.value : `${row.kind}     ${e.target.value}`)}
                  aria-label={`Force-field line ${row.kind}`}
                />
                <button
                  type="button"
                  style={css.removeIcon}
                  onClick={() => removeLine(row.id)}
                  aria-label="Remove line"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={css.addBar}>
          <Select value={pick} onValueChange={setPick} ariaLabel="Force-field command" className="flex-1 min-w-40">
            {FORCE_FIELD_PRESETS.map((p) => <SelectItem key={p.kind} value={p.kind}>{p.label}</SelectItem>)}
          </Select>
          <button type="button" style={css.btnSm} onClick={addLine}>Add</button>
        </div>
      </SettingsRow>
    </SettingsSection>
  );
}
