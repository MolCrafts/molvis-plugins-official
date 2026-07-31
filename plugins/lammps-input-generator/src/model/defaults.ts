import type {
  ForceFieldPlaceholders,
  InitConfig,
  LammpsEqConfig,
  MinimizeConfig,
  OutputConfig,
  TempControlPoint,
} from "./types";

let pointSeq = 0;

export function nextPointId(): string {
  pointSeq += 1;
  return `tp-${pointSeq}`;
}

export function defaultForceField(): ForceFieldPlaceholders {
  return {
    pairStyle: "lj/cut/coul/long 12.0",
    pairCoeff: "* * 0.1 3.5",
    extraLines: "",
    includeCommentedStubs: true,
  };
}

export function defaultInit(): InitConfig {
  return {
    units: "real",
    atomStyle: "full",
    boundary: ["p", "p", "p"],
    dataFile: "data.lmp",
    timestep: 1.0,
    thermoEvery: 1000,
    thermoStyle: "custom step temp pe ke etotal press vol",
    neighborSkin: 2.0,
    neighborCheck: true,
    forceField: defaultForceField(),
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
  partial?: Partial<TempControlPoint>,
): TempControlPoint {
  return {
    id: nextPointId(),
    step: 0,
    temperature: 300,
    ensemble: "nvt",
    thermostat: "nose-hoover",
    tdamp: 100,
    ...partial,
  };
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

export function defaultConfig(): LammpsEqConfig {
  pointSeq = 0;
  return {
    init: defaultInit(),
    minimize: defaultMinimize(),
    tempPoints: [
      defaultTempPoint({
        name: "start",
        step: 0,
        temperature: 300,
        ensemble: "nvt",
      }),
      defaultTempPoint({
        name: "NVT hold",
        step: 50_000,
        temperature: 300,
        ensemble: "nvt",
        thermostat: "nose-hoover",
        tdamp: 100,
      }),
      defaultTempPoint({
        name: "NPT",
        step: 150_000,
        temperature: 300,
        ensemble: "npt",
        thermostat: "nose-hoover",
        pStart: 1.0,
        pStop: 1.0,
        tdamp: 100,
        pdamp: 1000,
      }),
    ],
    output: defaultOutput(),
  };
}

export const STORAGE_KEY = "lammps-input-config-v2";
