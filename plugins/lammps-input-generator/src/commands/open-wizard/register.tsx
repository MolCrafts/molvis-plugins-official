import { createRoot, type Root } from "react-dom/client";
import type { PluginAPI } from "../../types/plugin-api";
import { WizardDialog } from "../../ui/WizardDialog";

let hostEl: HTMLDivElement | null = null;
let root: Root | null = null;

function closeWizard(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (hostEl) {
    hostEl.remove();
    hostEl = null;
  }
}

export function openWizard(api: PluginAPI): void {
  closeWizard();
  hostEl = document.createElement("div");
  hostEl.dataset.molvisPlugin = "lammps-input-generator";
  document.body.appendChild(hostEl);
  root = createRoot(hostEl);
  root.render(
    <WizardDialog storage={api.storage} onClose={closeWizard} />,
  );
}

/**
 * Register toolbar command that opens the multi-step generator dialog.
 * UI is owned by the command (portal), not a free-floating host chrome API.
 */
export function registerOpenWizard(api: PluginAPI): void {
  api.commands.register(
    "open-wizard",
    () => {
      openWizard(api);
    },
    {
      toolbar: {
        label: "LAMMPS Input",
        order: 40,
      },
    },
  );
}

export function disposeWizardHost(): void {
  closeWizard();
}
