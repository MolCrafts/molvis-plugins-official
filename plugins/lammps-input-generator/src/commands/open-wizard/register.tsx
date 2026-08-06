import type { PluginAPI } from "@molcrafts/molvis-plugin";
import { WizardDialog } from "../../ui/WizardDialog";
import { COMMANDS, DIALOG_ID } from "../../version";

/**
 * Register the generator wizard as a host dialog plus a palette command that
 * opens it.
 *
 * This used to mount its own `createRoot` portal on `document.body` and keep
 * module-level `hostEl` / `root` handles that had to be torn down by hand —
 * a second modal lifecycle alongside the Alchemist plugin's. The host owns
 * the dialog shell, so the plugin owns only its body content.
 */
export function registerOpenWizard(api: PluginAPI): void {
  api.dialogs.register({
    id: DIALOG_ID,
    title: "LAMMPS Template",
    size: "xl",
    render: () => <WizardDialog storage={api.storage} />,
  });

  api.commands.register(COMMANDS.openWizard, () => {}, {
    toolbar: {
      label: "LAMMPS Template",
      order: 40,
      opensDialog: DIALOG_ID,
    },
  });
}
