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

/** One force-field script line added from the preset dropdown (or custom). */
export interface ForceFieldLine {
  id: string;
  /** Full logical line (may start with `#`). */
  text: string;
  /** Preset kind key, or `"custom"`. */
  kind: string;
}

export interface ForceFieldPlaceholders {
  /** Ordered LAMMPS force-field commands. Pair commands are not special. */
  lines: ForceFieldLine[];
  /** @deprecated v2 draft/RPC compatibility; the form migrates these to lines. */
  pairStyle?: string;
  /** @deprecated v2 draft/RPC compatibility; the form migrates these to lines. */
  pairCoeff?: string;
}

export type NeighborStyle = "bin" | "nsq" | "multi";

export interface NeighborConfig {
  skin: number;
  style: NeighborStyle;
  every: number;
  delay: number;
  check: boolean;
  once: boolean;
  page: number;
  one: number;
  /** 0 lets LAMMPS choose the bin size. */
  binsize: number;
}

export interface InitConfig {
  units: LammpsUnits;
  atomStyle: string;
  boundary: [BoundaryFlag, BoundaryFlag, BoundaryFlag];
  dataFile: string;
  timestep: number;
  thermoEvery: number;
  thermoStyle: string;
  neighbor?: NeighborConfig;
  forceField: ForceFieldPlaceholders;
}

export interface MinimizeConfig {
  etol: number;
  ftol: number;
  maxiter: number;
  maxeval: number;
  minStyle: string;
  dmax?: number;
  norm?: "two" | "max" | "inf";
  fireIntegrator?: "eulerimplicit" | "verlet" | "leapfrog";
  fireTmax?: number;
}

/**
 * Temperature control point.
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
  /**
   * `fix langevin` RNG seed for this segment. Must differ between replicas
   * that are meant to be statistically independent.
   */
  langevinSeed?: number;
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
  /** See {@link TempControlPoint.langevinSeed}. */
  langevinSeed?: number;
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
