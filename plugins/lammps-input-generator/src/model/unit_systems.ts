import type { LammpsUnits } from "./types";

/**
 * Per-unit-system defaults, taken from LAMMPS' own documented defaults.
 *
 * These numbers are **not** interchangeable between unit systems: a 1.0
 * timestep means 1 fs under `real` but 1 ps under `metal` — a 1000×
 * error that LAMMPS accepts without complaint and that blows the
 * integrator up. Anything time- or length-valued therefore has to be read
 * from this table rather than written as a literal.
 *
 * Sources: LAMMPS `units`, `timestep` and `neighbor` documentation.
 */
export interface UnitSystemDefaults {
  /** LAMMPS default `timestep`, in the system's time unit. */
  timestep: number;
  /** LAMMPS default `neighbor` skin, in the system's distance unit. */
  neighborSkin: number;
  /** Conventional starting temperature, in the system's temperature unit. */
  temperature: number;
  /** Time unit, for UI labels. */
  timeUnit: string;
  /** Distance unit, for UI labels. */
  distanceUnit: string;
  /** Pressure unit, for UI labels — `pStart`/`pStop` are read in it. */
  pressureUnit: string;
}

export const UNIT_SYSTEM_DEFAULTS: Readonly<
  Record<LammpsUnits, UnitSystemDefaults>
> = {
  lj: {
    timestep: 0.005,
    neighborSkin: 0.3,
    temperature: 1.0,
    timeUnit: "τ",
    distanceUnit: "σ",
    pressureUnit: "reduced",
  },
  real: {
    timestep: 1.0,
    neighborSkin: 2.0,
    temperature: 300,
    timeUnit: "fs",
    distanceUnit: "Å",
    pressureUnit: "atm",
  },
  metal: {
    timestep: 0.001,
    neighborSkin: 2.0,
    temperature: 300,
    timeUnit: "ps",
    distanceUnit: "Å",
    pressureUnit: "bar",
  },
  si: {
    timestep: 1.0e-8,
    neighborSkin: 0.001,
    temperature: 300,
    timeUnit: "s",
    distanceUnit: "m",
    pressureUnit: "Pa",
  },
  cgs: {
    timestep: 1.0e-8,
    neighborSkin: 0.1,
    temperature: 300,
    timeUnit: "s",
    distanceUnit: "cm",
    pressureUnit: "dyn/cm²",
  },
  electron: {
    timestep: 0.001,
    neighborSkin: 2.0,
    temperature: 300,
    timeUnit: "fs",
    distanceUnit: "Bohr",
    pressureUnit: "Pa",
  },
  micro: {
    timestep: 2.0,
    neighborSkin: 0.1,
    temperature: 300,
    timeUnit: "µs",
    distanceUnit: "µm",
    pressureUnit: "picogram/(µm·µs²)",
  },
  nano: {
    timestep: 0.00045,
    neighborSkin: 10.0,
    temperature: 300,
    timeUnit: "ns",
    distanceUnit: "nm",
    pressureUnit: "attogram/(nm·ns²)",
  },
};

/**
 * LAMMPS rule of thumb for Nosé-Hoover / Berendsen / Langevin damping:
 * couple over ~100 timesteps for temperature and ~1000 for pressure.
 * Expressed as timestep multiples so the result lands in whatever time
 * unit the active system uses.
 */
export const TDAMP_TIMESTEP_MULTIPLE = 100;
export const PDAMP_TIMESTEP_MULTIPLE = 1000;

export function unitDefaults(units: LammpsUnits): UnitSystemDefaults {
  return UNIT_SYSTEM_DEFAULTS[units];
}
