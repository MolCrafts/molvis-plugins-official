/**
 * Force-field line presets for the Init “Add line” dropdown.
 * Values are ready-to-edit LAMMPS stubs.
 */
export interface ForceFieldPreset {
  kind: string;
  /** Dropdown label. */
  label: string;
  /** Default text inserted into the list. */
  text: string;
}

export const FORCE_FIELD_PRESETS: ForceFieldPreset[] = [
  {
    kind: "pair_style",
    label: "pair_style",
    text: "pair_style     lj/cut/coul/long 12.0",
  },
  {
    kind: "pair_coeff",
    label: "pair_coeff",
    text: "pair_coeff     * * 0.1 3.5",
  },
  {
    kind: "bond_style",
    label: "bond_style",
    text: "bond_style     harmonic",
  },
  {
    kind: "bond_coeff",
    label: "bond_coeff",
    text: "bond_coeff     1 300.0 1.0",
  },
  {
    kind: "angle_style",
    label: "angle_style",
    text: "angle_style    harmonic",
  },
  {
    kind: "angle_coeff",
    label: "angle_coeff",
    text: "angle_coeff    1 50.0 109.5",
  },
  {
    kind: "dihedral_style",
    label: "dihedral_style",
    text: "dihedral_style opls",
  },
  {
    kind: "dihedral_coeff",
    label: "dihedral_coeff",
    text: "dihedral_coeff 1 0.0 0.0 0.0 0.0",
  },
  {
    kind: "improper_style",
    label: "improper_style",
    text: "improper_style cvff",
  },
  {
    kind: "improper_coeff",
    label: "improper_coeff",
    text: "improper_coeff 1 20.0  -1  2",
  },
  {
    kind: "kspace_style",
    label: "kspace_style",
    text: "kspace_style   pppm 1.0e-4",
  },
  {
    kind: "special_bonds",
    label: "special_bonds",
    text: "special_bonds  lj/coul 0.0 0.0 0.5",
  },
  {
    kind: "custom",
    label: "Custom line…",
    text: "",
  },
];

export function presetByKind(kind: string): ForceFieldPreset | undefined {
  return FORCE_FIELD_PRESETS.find((p) => p.kind === kind);
}
