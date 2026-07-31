/** Units styles supported in the Init form (LAMMPS `units` keyword). */
export type LammpsUnits =
  | "real"
  | "metal"
  | "lj"
  | "si"
  | "cgs"
  | "electron"
  | "micro"
  | "nano";

export type BoundaryFlag = "p" | "f" | "s" | "m";

export type Ensemble = "nve" | "nvt" | "npt";

/** Thermostat style for NVT/NPT segments. */
export type Thermostat = "nose-hoover" | "berendsen" | "langevin";

export interface ForceFieldPlaceholders {
  /** Emitted as-is (one logical line). */
  pairStyle: string;
  /** Emitted as-is (one logical line). */
  pairCoeff: string;
  /**
   * Extra free-form LAMMPS lines (bond/angle/… or overrides).
   * Blank lines preserved; `#` comments allowed.
   */
  extraLines: string;
  /**
   * When true, append the standard commented stubs
   * (bond/angle/dihedral/improper/kspace/special_bonds).
   */
  includeCommentedStubs: boolean;
}

export interface InitConfig {
  units: LammpsUnits;
  atomStyle: string;
  boundary: [BoundaryFlag, BoundaryFlag, BoundaryFlag];
  dataFile: string;
  timestep: number;
  thermoEvery: number;
  thermoStyle: string;
  neighborSkin: number;
  neighborCheck: boolean;
  forceField: ForceFieldPlaceholders;
}

export interface MinimizeConfig {
  etol: number;
  ftol: number;
  maxiter: number;
  maxeval: number;
  minStyle: string;
}

/**
 * Temperature control point (调温点).
 *
 * The T schedule is the piecewise-linear polyline through these points
 * (sorted by `step`). Point 0 is the initial temperature; each later point
 * ends a segment whose ensemble/thermostat come from that point.
 */
export interface TempControlPoint {
  id: string;
  /** Absolute cumulative MD step (≥ previous point). */
  step: number;
  temperature: number;
  name?: string;
  /**
   * Ensemble of the segment *ending* at this point.
   * Ignored for the first point (step origin).
   */
  ensemble: Ensemble;
  /** NVT/NPT only. */
  thermostat?: Thermostat;
  pStart?: number;
  pStop?: number;
  tdamp?: number;
  pdamp?: number;
}

/** Derived run segment between two control points (for generate / tests). */
export interface EqStage {
  id: string;
  name?: string;
  ensemble: Ensemble;
  thermostat?: Thermostat;
  tStart: number;
  tStop: number;
  pStart?: number;
  pStop?: number;
  nsteps: number;
  tdamp?: number;
  pdamp?: number;
}

export interface DumpConfig {
  every: number;
  path: string;
  style: string;
}

export interface RestartConfig {
  every: number;
  path: string;
}

export interface OutputConfig {
  dump: DumpConfig | null;
  restart: RestartConfig | null;
  writeData: string | null;
}

export interface LammpsEqConfig {
  init: InitConfig;
  /** null = skip minimize block. */
  minimize: MinimizeConfig | null;
  /** ≥ 2 points recommended; sorted by step when generating. */
  tempPoints: TempControlPoint[];
  output: OutputConfig;
}

export interface SchedulePoint {
  x: number;
  y: number;
}
