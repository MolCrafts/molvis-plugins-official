import type { OutputConfig } from "../../model/types";
import { css } from "../styles";
import { Checkbox } from "@/components/ui/checkbox";

export function OutputStep({
  value,
  onChange,
}: {
  value: OutputConfig;
  onChange: (next: OutputConfig) => void;
}) {
  const dumpOn = value.dump != null;
  const restartOn = value.restart != null;
  const writeOn = value.writeData != null;

  return (
    <div>
      <section style={css.section}>
        <label style={css.checkRow}>
          <Checkbox
            checked={dumpOn}
            onCheckedChange={(checked) =>
              onChange({
                ...value,
                dump: checked === true
                  ? {
                      every: 1000,
                      path: "dump.eq.lammpstrj",
                      style: "custom id type x y z",
                    }
                  : null,
              })
            }
          />
          Dump trajectory
        </label>
        {dumpOn && value.dump && (
          <div style={css.row}>
            <label style={css.field}>
              <span style={css.label}>Every</span>
              <input
                style={css.input}
                type="number"
                value={value.dump.every}
                onChange={(e) =>
                  onChange({
                    ...value,
                    dump: { ...value.dump!, every: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label style={css.field}>
              <span style={css.label}>Path</span>
              <input
                style={css.input}
                value={value.dump.path}
                onChange={(e) =>
                  onChange({
                    ...value,
                    dump: { ...value.dump!, path: e.target.value },
                  })
                }
              />
            </label>
            <label style={{ ...css.field, gridColumn: "1 / -1" }}>
              <span style={css.label}>Style args (after group)</span>
              <input
                style={css.input}
                value={value.dump.style}
                onChange={(e) =>
                  onChange({
                    ...value,
                    dump: { ...value.dump!, style: e.target.value },
                  })
                }
              />
            </label>
          </div>
        )}
      </section>

      <section style={css.section}>
        <label style={css.checkRow}>
          <Checkbox
            checked={restartOn}
            onCheckedChange={(checked) =>
              onChange({
                ...value,
                restart: checked === true
                  ? { every: 10_000, path: "restart.eq" }
                  : null,
              })
            }
          />
          Restart files
        </label>
        {restartOn && value.restart && (
          <div style={css.row}>
            <label style={css.field}>
              <span style={css.label}>Every</span>
              <input
                style={css.input}
                type="number"
                value={value.restart.every}
                onChange={(e) =>
                  onChange({
                    ...value,
                    restart: {
                      ...value.restart!,
                      every: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label style={css.field}>
              <span style={css.label}>Path prefix</span>
              <input
                style={css.input}
                value={value.restart.path}
                onChange={(e) =>
                  onChange({
                    ...value,
                    restart: { ...value.restart!, path: e.target.value },
                  })
                }
              />
            </label>
          </div>
        )}
      </section>

      <section style={css.section}>
        <label style={css.checkRow}>
          <Checkbox
            checked={writeOn}
            onCheckedChange={(checked) =>
              onChange({
                ...value,
                writeData: checked === true ? "data.eq.lmp" : null,
              })
            }
          />
          write_data at end
        </label>
        {writeOn && (
          <label style={css.field}>
            <span style={css.label}>Path</span>
            <input
              style={css.input}
              value={value.writeData ?? ""}
              onChange={(e) =>
                onChange({ ...value, writeData: e.target.value })
              }
            />
          </label>
        )}
      </section>
    </div>
  );
}
