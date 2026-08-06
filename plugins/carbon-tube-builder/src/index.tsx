import {
  CarbonTubeBuilder,
  type Frame,
} from "@molcrafts/molvis-core/molrs";
import { useState } from "react";

import type { Molvis, MolvisPluginModule, PluginAPI } from "@molcrafts/molvis-plugin";
import "./styles.css";
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_VERSION } from "./version";

interface EditStampMode {
  name: string;
  pendingMolecule: Frame | null;
}

function getEditMode(app: Molvis): EditStampMode | null {
  const mode = app.mode as unknown;
  if (!mode || typeof mode !== "object") return null;
  const candidate = mode as Partial<EditStampMode>;
  return candidate.name === "edit" && "pendingMolecule" in candidate
    ? (candidate as EditStampMode)
    : null;
}

function numberValue(event: React.ChangeEvent<HTMLInputElement>): number {
  return event.currentTarget.valueAsNumber;
}

const CarbonTubePanel: React.FC<{ app: Molvis | null }> = ({ app }) => {
  const [n, setN] = useState(6);
  const [m, setM] = useState(0);
  const [cells, setCells] = useState(2);
  const [bondLength, setBondLength] = useState(1.42);
  const [vacuum, setVacuum] = useState(10);
  const [periodic, setPeriodic] = useState(false);
  const [message, setMessage] = useState(
    "Build a tube, then click the 3D canvas to place it.",
  );
  const [failed, setFailed] = useState(false);

  const build = (event: React.FormEvent) => {
    event.preventDefault();
    if (!app) return;

    try {
      const builder = new CarbonTubeBuilder(n, m);
      builder.setCells(cells);
      builder.setBondLength(bondLength);
      builder.setPeriodic(periodic);
      builder.setVacuum(vacuum);
      const frame = builder.build();
      builder.free();

      const editMode = getEditMode(app);
      if (!editMode) {
        frame.free();
        throw new Error("Switch to Edit mode first");
      }
      editMode.pendingMolecule = frame;
      setFailed(false);
      setMessage("Tube ready — click the 3D canvas to place copies.");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <form className="carbon-tube-builder" onSubmit={build}>
      <div className="carbon-tube-builder__grid">
        <label>
          <span>n</span>
          <input
            type="number"
            min={0}
            step={1}
            value={n}
            onChange={(event) => setN(numberValue(event))}
          />
        </label>
        <label>
          <span>m</span>
          <input
            type="number"
            min={0}
            step={1}
            value={m}
            onChange={(event) => setM(numberValue(event))}
          />
        </label>
        <label>
          <span>Cells</span>
          <input
            type="number"
            min={1}
            step={1}
            value={cells}
            onChange={(event) => setCells(numberValue(event))}
          />
        </label>
        <label>
          <span>Bond Å</span>
          <input
            type="number"
            min={0.1}
            step={0.01}
            value={bondLength}
            onChange={(event) => setBondLength(numberValue(event))}
          />
        </label>
        <label className="carbon-tube-builder__wide">
          <span>Vacuum Å</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={vacuum}
            onChange={(event) => setVacuum(numberValue(event))}
          />
        </label>
      </div>

      <label className="carbon-tube-builder__check">
        <input
          type="checkbox"
          checked={periodic}
          onChange={(event) => setPeriodic(event.currentTarget.checked)}
        />
        <span>Periodic along tube axis</span>
      </label>

      <button type="submit" disabled={!app}>
        Build &amp; place
      </button>
      <p
        className="carbon-tube-builder__status"
        data-error={failed || undefined}
        aria-live="polite"
      >
        {message}
      </p>
    </form>
  );
};

export function registerCarbonTubeBuilder(api: PluginAPI): void {
  api.modes.registerToolsPanel("edit", {
    id: "carbon-tube-builder",
    title: "Carbon tube",
    order: 100,
    render: CarbonTubePanel,
  });
}

const plugin: MolvisPluginModule = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  version: PLUGIN_VERSION,

  activate(api: PluginAPI) {
    registerCarbonTubeBuilder(api);
    api.log.info("carbon-tube-builder activate");
  },

  deactivate(api: PluginAPI) {
    api.log.info("carbon-tube-builder deactivate");
  },
};

export default plugin;
