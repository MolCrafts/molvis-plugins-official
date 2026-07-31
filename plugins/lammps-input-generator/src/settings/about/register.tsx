import type { PluginAPI } from "../../types/plugin-api";

export function registerAboutSettings(api: PluginAPI): void {
  api.settings.registerSection({
    id: "about",
    title: "LAMMPS Input",
    order: 80,
    render: () => (
      <div style={{ fontSize: 12, opacity: 0.88, lineHeight: 1.5 }}>
        Generate multi-stage LAMMPS input scripts (minimize + NVT/NPT/NVE,
        force-field placeholders, dump/restart). Open via the
        <strong>LAMMPS Input</strong> toolbar button. Temperature schedule is
        previewed with molplot; pair_style/coeff are stubs — edit for your
        system.
      </div>
    ),
  });
}
