import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateLammpsEqInput } from "../generate/generate";
import {
  defaultConfig,
  normalizeConfig,
} from "../model/defaults";
import type { LammpsEqConfig } from "../model/types";
import type { PluginStorage } from "../types/plugin-api";
import {
  DEFAULT_SCRIPT_FILENAME,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
} from "../version";
import { ForceFieldSection } from "./sections/ForceFieldSection";
import { NeighborSection } from "./sections/NeighborSection";
import { SystemSection } from "./sections/SystemSection";
import { ThermoSection } from "./sections/ThermoSection";
import { EquilibrationStep } from "./steps/EquilibrationStep";
import { MinimizeStep } from "./steps/MinimizeStep";
import { OutputStep } from "./steps/OutputStep";
import { PreviewStep } from "./steps/PreviewStep";
import { SettingsSection } from "./SettingsSection";
import { css } from "./styles";

const CATEGORIES = [
  { id: "system", label: "System" },
  { id: "forcefield", label: "Force field" },
  { id: "neighbor", label: "Neighbor" },
  { id: "thermo", label: "Thermo" },
  { id: "minimize", label: "Minimize" },
  { id: "equilibration", label: "Equilibration" },
  { id: "output", label: "Output" },
  { id: "preview", label: "Preview" },
] as const;

function loadDraft(storage: PluginStorage | null): LammpsEqConfig {
  if (!storage) return defaultConfig();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      // try previous key once
      const legacy = storage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const n = normalizeConfig(JSON.parse(legacy));
        if (n) return n;
      }
      return defaultConfig();
    }
    return normalizeConfig(JSON.parse(raw)) ?? defaultConfig();
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

/** Compact host-native settings surface: hairline navigation and one scroll area. */
export function WizardDialog({
  storage,
}: {
  storage: PluginStorage | null;
}) {
  const [config, setConfig] = useState<LammpsEqConfig>(() => loadDraft(storage));
  const [activeId, setActiveId] = useState<string>(CATEGORIES[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navLockUntil = useRef(0);

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

  const scrollToCategory = useCallback((id: string) => {
    const root = scrollRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(
      `[data-settings-section="${id}"]`,
    );
    if (!target) return;
    setActiveId(id);
    navLockUntil.current = performance.now() + 450;
    const top =
      target.getBoundingClientRect().top -
      root.getBoundingClientRect().top +
      root.scrollTop;
    root.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const ids = CATEGORIES.map((c) => c.id);
    const nodes = ids
      .map((id) =>
        root.querySelector<HTMLElement>(`[data-settings-section="${id}"]`),
      )
      .filter((el): el is HTMLElement => el != null);
    if (nodes.length === 0) return;

    const updateActive = () => {
      if (performance.now() < navLockUntil.current) return;
      const rootTop = root.getBoundingClientRect().top;
      const threshold = rootTop + root.clientHeight * 0.28;
      let current = nodes[0].dataset.settingsSection ?? nodes[0].id;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= threshold) {
          current = node.dataset.settingsSection ?? node.id;
        } else {
          break;
        }
      }
      setActiveId((prev) => (prev === current ? prev : current));
    };

    updateActive();
    root.addEventListener("scroll", updateActive, { passive: true });
    return () => root.removeEventListener("scroll", updateActive);
  }, []);

  const setInit = (init: typeof config.init) => persist({ ...config, init });

  // Scrim, Escape, focus trap and the title/close header belong to the host
  // dialog shell (`api.dialogs`). This component renders body content only —
  // it used to hand-roll all of that, in parallel with a second, subtly
  // different implementation in the Alchemist plugin.
  return (
    <div style={css.bodyRow}>
          <nav style={css.rail} aria-label="LAMMPS sections">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                style={css.railBtn(activeId === cat.id)}
                aria-current={activeId === cat.id ? "true" : undefined}
                onClick={() => scrollToCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </nav>

          <div ref={scrollRef} style={css.scroll}>
            <div style={css.page}>
              <SystemSection value={config.init} onChange={setInit} />
              <ForceFieldSection
                value={config.init.forceField}
                onChange={(forceField) =>
                  setInit({ ...config.init, forceField })
                }
              />
              <NeighborSection value={config.init} onChange={setInit} />
              <ThermoSection value={config.init} onChange={setInit} />

              <SettingsSection
                id="minimize"
                title="Minimize"
                description="Optional energy minimization before equilibration stages."
              >
                <MinimizeStep
                  value={config.minimize}
                  onChange={(minimize) => persist({ ...config, minimize })}
                />
              </SettingsSection>

              <SettingsSection
                id="equilibration"
                title="Equilibration"
                description="Temperature schedule. Each control point ends a run segment."
              >
                <EquilibrationStep
                  tempPoints={config.tempPoints}
                  units={config.init.units}
                  onChange={(tempPoints) => persist({ ...config, tempPoints })}
                />
              </SettingsSection>

              <SettingsSection
                id="output"
                title="Output"
                description="Dump, restart, and final write_data paths."
              >
                <OutputStep
                  value={config.output}
                  onChange={(output) => persist({ ...config, output })}
                />
              </SettingsSection>

              <SettingsSection
                id="preview"
                title="Preview"
                description="Generated classic LAMMPS input script."
                last
              >
                <PreviewStep
                  script={script}
                  onCopy={() => void onCopy()}
                  onDownload={() => downloadText(DEFAULT_SCRIPT_FILENAME, script)}
                />
              </SettingsSection>
      </div>
    </div>
  </div>
  );
}
