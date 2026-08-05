import type {
  ForceFieldLine,
  ForceFieldPlaceholders,
  InitConfig,
  LammpsEqConfig,
  LammpsUnits,
  MinimizeConfig,
  OutputConfig,
  TempControlPoint,
} from "./types";
import {
  PDAMP_TIMESTEP_MULTIPLE,
  TDAMP_TIMESTEP_MULTIPLE,
  unitDefaults,
} from "./unit_systems";

/** Unit system assumed when the caller does not name one. */
export const DEFAULT_UNITS: LammpsUnits = "real";

let pointSeq = 0;
let ffLineSeq = 0;

/**
 * A fresh `fix langevin` seed.
 *
 * Every Langevin segment needs its own: a shared seed makes nominally
 * independent replicas reproduce identical thermostat noise, which LAMMPS
 * runs happily and which quietly invalidates the ensemble. Randomised here,
 * at config-construction time, so that script generation stays pure and
 * reproducible for a given config.
 */
export function nextLangevinSeed(): number {
  return 1 + Math.floor(Math.random() * 899_999_999);
}

export function nextPointId(): string {
  pointSeq += 1;
  return `tp-${pointSeq}`;
}

export function nextFfLineId(): string {
  ffLineSeq += 1;
  return `ff-${ffLineSeq}`;
}

export function makeFfLine(
  partial: Pick<ForceFieldLine, "text" | "kind"> & { id?: string },
): ForceFieldLine {
  return {
    id: partial.id ?? nextFfLineId(),
    text: partial.text,
    kind: partial.kind,
  };
}

export function defaultForceField(): ForceFieldPlaceholders {
  return {
    lines: [
      makeFfLine({ kind: "pair_style", text: "pair_style     lj/cut/coul/long 12.0" }),
      makeFfLine({ kind: "pair_coeff", text: "pair_coeff     * * 0.1 3.5" }),
      makeFfLine({ kind: "kspace_style", text: "kspace_style   pppm 1.0e-4" }),
    ],
  };
}

export function defaultInit(units: LammpsUnits = DEFAULT_UNITS): InitConfig {
  const u = unitDefaults(units);
  return {
    units,
    atomStyle: "full",
    boundary: ["p", "p", "p"],
    dataFile: "data.lmp",
    timestep: u.timestep,
    thermoEvery: 1000,
    thermoStyle: "custom step temp pe ke etotal press vol",
    neighbor: {
      skin: u.neighborSkin,
      style: "bin",
      every: 1,
      delay: 0,
      check: true,
      once: false,
      page: 100000,
      one: 2000,
      binsize: 0,
    },
    neighborSkin: u.neighborSkin,
    neighborCheck: true,
    forceField: defaultForceField(),
  };
}

/**
 * Re-derive the unit-dependent fields of an existing init block after the
 * user switches unit system. Length- and time-valued numbers do not carry
 * over between systems, so they are replaced rather than kept.
 */
export function withUnits(init: InitConfig, units: LammpsUnits): InitConfig {
  const u = unitDefaults(units);
  return {
    ...init,
    units,
    timestep: u.timestep,
    neighbor: { ...(init.neighbor ?? defaultInit(units).neighbor!), skin: u.neighborSkin },
    neighborSkin: u.neighborSkin,
  };
}

export function defaultMinimize(): MinimizeConfig {
  return {
    etol: 1.0e-4,
    ftol: 1.0e-6,
    maxiter: 1000,
    maxeval: 10000,
    minStyle: "cg",
  };
}

export function defaultTempPoint(
  units: LammpsUnits = DEFAULT_UNITS,
  partial?: Partial<TempControlPoint>,
): TempControlPoint {
  const u = unitDefaults(units);
  return {
    id: nextPointId(),
    step: 0,
    temperature: u.temperature,
    ensemble: "nvt",
    thermostat: "nose-hoover",
    tdamp: u.timestep * TDAMP_TIMESTEP_MULTIPLE,
    langevinSeed: nextLangevinSeed(),
    // Explicit `undefined` in `partial` means "carry nothing over" — it must
    // not blank out the unit-derived default it lands on.
    ...omitUndefined(partial ?? {}),
  };
}

function omitUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export function defaultOutput(): OutputConfig {
  return {
    dump: {
      every: 1000,
      path: "dump.eq.lammpstrj",
      style: "custom id type x y z",
    },
    restart: {
      every: 10_000,
      path: "restart.eq",
    },
    writeData: "data.eq.lmp",
  };
}

/** Step counts of the stock three-point NVT-hold → NPT schedule. */
const NVT_HOLD_END_STEP = 50_000;
const NPT_END_STEP = 150_000;

export function defaultConfig(
  units: LammpsUnits = DEFAULT_UNITS,
): LammpsEqConfig {
  pointSeq = 0;
  ffLineSeq = 0;
  const u = unitDefaults(units);
  const pdamp = u.timestep * PDAMP_TIMESTEP_MULTIPLE;
  return {
    init: defaultInit(units),
    minimize: defaultMinimize(),
    tempPoints: [
      defaultTempPoint(units, { name: "start", step: 0, ensemble: "nvt" }),
      defaultTempPoint(units, {
        name: "NVT hold",
        step: NVT_HOLD_END_STEP,
        ensemble: "nvt",
        thermostat: "nose-hoover",
      }),
      defaultTempPoint(units, {
        name: "NPT",
        step: NPT_END_STEP,
        ensemble: "npt",
        thermostat: "nose-hoover",
        pStart: 1.0,
        pStop: 1.0,
        pdamp,
      }),
    ],
    output: defaultOutput(),
  };
}

/**
 * Normalize drafts from storage (v2 extraLines string → lines list).
 */
export function normalizeConfig(raw: unknown): LammpsEqConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as LammpsEqConfig & {
    init?: InitConfig & {
      neighborSkin?: number;
      neighborCheck?: boolean;
      forceField?: ForceFieldPlaceholders & {
        extraLines?: string;
        includeCommentedStubs?: boolean;
        lines?: ForceFieldLine[];
      };
    };
  };
  if (!parsed.init || !Array.isArray(parsed.tempPoints)) return null;

  const ff = parsed.init.forceField ?? defaultForceField();
  let lines: ForceFieldLine[] = Array.isArray(ff.lines) ? [...ff.lines] : [];

  const legacyFf = ff as ForceFieldPlaceholders & {
    pairStyle?: string;
    pairCoeff?: string;
  };
  if (legacyFf.pairStyle) {
    lines.unshift(makeFfLine({ kind: "pair_style", text: `pair_style     ${legacyFf.pairStyle}` }));
  }
  if (legacyFf.pairCoeff) {
    const pairIndex = lines.findIndex((line) => line.kind === "pair_style");
    lines.splice(pairIndex + 1, 0, makeFfLine({ kind: "pair_coeff", text: `pair_coeff     ${legacyFf.pairCoeff}` }));
  }

  // Migrate free-form textarea from older drafts.
  if (lines.length === 0 && typeof ff.extraLines === "string" && ff.extraLines) {
    lines = ff.extraLines
      .split("\n")
      .map((t) => t.trimEnd())
      .filter((t) => t.trim() !== "")
      .map((text) => makeFfLine({ text, kind: "custom" }));
  }

  return {
    ...parsed,
    init: {
      ...parsed.init,
      neighbor: parsed.init.neighbor ?? {
        ...defaultInit(parsed.init.units).neighbor!,
        skin: parsed.init.neighborSkin ?? unitDefaults(parsed.init.units).neighborSkin,
        check: parsed.init.neighborCheck ?? true,
      },
      forceField: { lines: lines.length > 0 ? lines : defaultForceField().lines },
    },
    // Drafts saved before langevinSeed existed share one hardcoded seed at
    // generate time; give each point its own so replicas stay independent.
    tempPoints: parsed.tempPoints.map((p) =>
      p.langevinSeed == null ? { ...p, langevinSeed: nextLangevinSeed() } : p,
    ),
  };
}
