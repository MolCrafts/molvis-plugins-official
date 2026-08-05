import type { PluginAPI } from "../../types/plugin-api";

export function registerAboutSettings(api: PluginAPI): void {
  api.settings.registerSection({
    id: "about",
    title: "General",
    group: "LAMMPS Template",
    order: 80,
    render: () => null,
  });
}
