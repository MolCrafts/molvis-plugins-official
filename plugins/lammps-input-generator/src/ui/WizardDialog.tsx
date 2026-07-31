import { useCallback, useMemo, useState } from "react";
import { generateLammpsEqInput } from "../generate/generate";
import { defaultConfig, STORAGE_KEY } from "../model/defaults";
import type { LammpsEqConfig } from "../model/types";
import type { PluginStorage } from "../types/plugin-api";
import { EquilibrationStep } from "./steps/EquilibrationStep";
import { InitStep } from "./steps/InitStep";
import { MinimizeStep } from "./steps/MinimizeStep";
import { OutputStep } from "./steps/OutputStep";
import { PreviewStep } from "./steps/PreviewStep";
import { css } from "./styles";

const STEPS = [
  "Init",
  "Minimize",
  "Equilibration",
  "Output",
  "Preview",
] as const;

function loadDraft(storage: PluginStorage | null): LammpsEqConfig {
  if (!storage) return defaultConfig();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as LammpsEqConfig;
    if (!parsed?.init || !Array.isArray(parsed.tempPoints)) {
      return defaultConfig();
    }
    return parsed;
  } catch {
    return defaultConfig();
  }
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function WizardDialog({
  storage,
  onClose,
}: {
  storage: PluginStorage | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<LammpsEqConfig>(() => loadDraft(storage));

  const script = useMemo(() => generateLammpsEqInput(config), [config]);

  const persist = useCallback(
    (next: LammpsEqConfig) => {
      setConfig(next);
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
    },
    [storage],
  );

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(script);
    } catch {
      globalThis.prompt?.("Copy script:", script);
    }
  };

  return (
    <div
      style={css.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="LAMMPS input generator"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={css.panel}>
        <header style={css.header}>
          <h2 style={css.title}>LAMMPS input</h2>
          <button type="button" style={css.btn("ghost")} onClick={onClose}>
            Close
          </button>
        </header>

        <nav style={css.steps}>
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              style={css.stepBtn(i === step, i < step)}
              onClick={() => setStep(i)}
            >
              {i + 1}. {label}
            </button>
          ))}
        </nav>

        <div style={css.body}>
          {step === 0 && (
            <InitStep
              value={config.init}
              onChange={(init) => persist({ ...config, init })}
            />
          )}
          {step === 1 && (
            <MinimizeStep
              value={config.minimize}
              onChange={(minimize) => persist({ ...config, minimize })}
            />
          )}
          {step === 2 && (
            <EquilibrationStep
              tempPoints={config.tempPoints}
              onChange={(tempPoints) => persist({ ...config, tempPoints })}
            />
          )}
          {step === 3 && (
            <OutputStep
              value={config.output}
              onChange={(output) => persist({ ...config, output })}
            />
          )}
          {step === 4 && (
            <PreviewStep
              script={script}
              onCopy={() => void onCopy()}
              onDownload={() => downloadText("in.eq", script)}
            />
          )}
        </div>

        <footer style={css.footer}>
          <button
            type="button"
            style={css.btn("ghost")}
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                style={css.btn("primary")}
                onClick={() =>
                  setStep((s) => Math.min(STEPS.length - 1, s + 1))
                }
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                style={css.btn("primary")}
                onClick={() => downloadText("in.eq", script)}
              >
                Download in.eq
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
