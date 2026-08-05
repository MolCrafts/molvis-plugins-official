import { PLUGIN_VERSION } from "../version";
import { tempPointsToStages } from "../model/schedule";
import type {
  EqStage,
  ForceFieldPlaceholders,
  LammpsEqConfig,
  MinimizeConfig,
  OutputConfig,
  Thermostat,
} from "../model/types";
import {
  PDAMP_TIMESTEP_MULTIPLE,
  TDAMP_TIMESTEP_MULTIPLE,
} from "../model/unit_systems";

const GENERATOR_TAG = `molvis-plugins-official / lammps-input-generator v${PLUGIN_VERSION}`;

/**
 * Reproducible per-stage seed for configs saved before `langevinSeed`
 * existed. Distinct per stage, but identical across users — set an explicit
 * seed (the wizard assigns a random one) for statistically independent
 * replicas.
 */
function derivedLangevinSeed(stageId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < stageId.length; i++) {
    hash ^= stageId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 1 + (Math.abs(hash) % 899_999_999);
}

function padCmd(cmd: string, args: string): string {
  return `${cmd.padEnd(16)}${args}`.trimEnd();
}

function emitForceField(ff: ForceFieldPlaceholders): string[] {
  const commands = (ff.lines ?? [])
    .map((row) => row.text.trimEnd())
    .filter((l) => l.trim() !== "");
  if (ff.pairStyle && !commands.some((line) => /^\s*pair_style\b/.test(line))) {
    commands.unshift(padCmd("pair_style", ff.pairStyle));
  }
  if (ff.pairCoeff && !commands.some((line) => /^\s*pair_coeff\b/.test(line))) {
    const pairStyleIndex = commands.findIndex((line) => /^\s*pair_style\b/.test(line));
    commands.splice(pairStyleIndex + 1, 0, padCmd("pair_coeff", ff.pairCoeff));
  }
  // Preserve the old RPC output marker without reintroducing a separate pair
  // section in the current form model.
  if (ff.pairStyle || ff.pairCoeff) {
    const lastPair = commands.reduce((found, line, index) =>
      /^\s*pair_(?:style|coeff)\b/.test(line) ? index : found, -1);
    commands.splice(lastPair + 1, 0, "# --- force-field lines ---");
  }
  return ["# --- force field (placeholders — edit for your system) ---", ...commands];
}

/**
 * Damping constants follow the LAMMPS rule of thumb of ~100 (temperature)
 * and ~1000 (pressure) timesteps. They are deliberately *not* floored at
 * 1.0: the floor is meaningless outside `units real`, and under `metal`
 * (timestep 0.001 ps) it inflated tdamp 10× and pdamp 1000×.
 */
function defaultTdamp(stage: EqStage, timestep: number): number {
  if (stage.tdamp != null && stage.tdamp > 0) return stage.tdamp;
  return timestep * TDAMP_TIMESTEP_MULTIPLE;
}

function defaultPdamp(stage: EqStage, timestep: number): number {
  if (stage.pdamp != null && stage.pdamp > 0) return stage.pdamp;
  return timestep * PDAMP_TIMESTEP_MULTIPLE;
}

interface ThermoFixCommon {
  thermostat: Thermostat;
  tStart: number;
  tStop: number;
  tdamp: number;
  langevinSeed: number;
}

/**
 * `pArgs` is required for NPT and absent for NVT, so the two are separate
 * members rather than one shape with an optional field and a fallback
 * pressure string (which previously re-encoded pdamp=1000 as a literal).
 */
type ThermoFixSpec =
  | (ThermoFixCommon & { ensemble: "nvt" })
  | (ThermoFixCommon & { ensemble: "npt"; pArgs: string });

function thermoFix(spec: ThermoFixSpec): string {
  const { thermostat, tStart, tStop, tdamp, langevinSeed } = spec;
  if (spec.ensemble === "nvt") {
    if (thermostat === "nose-hoover") {
      return padCmd("fix", `1 all nvt temp ${tStart} ${tStop} ${tdamp}`);
    }
    if (thermostat === "berendsen") {
      return [
        padCmd("fix", `1 all temp/berendsen ${tStart} ${tStop} ${tdamp}`),
        padCmd("fix", "2 all nve"),
      ].join("\n");
    }
    return [
      padCmd(
        "fix",
        `1 all langevin ${tStart} ${tStop} ${tdamp} ${langevinSeed}`,
      ),
      padCmd("fix", "2 all nve"),
    ].join("\n");
  }
  const p = spec.pArgs;
  if (thermostat === "nose-hoover") {
    return padCmd("fix", `1 all npt temp ${tStart} ${tStop} ${tdamp} ${p}`);
  }
  if (thermostat === "berendsen") {
    const pressPart = p.replace(/^iso\s+/, "");
    return [
      padCmd("fix", `1 all temp/berendsen ${tStart} ${tStop} ${tdamp}`),
      padCmd("fix", `2 all press/berendsen iso ${pressPart}`),
      padCmd("fix", "3 all nve"),
    ].join("\n");
  }
  return [
    padCmd("fix", `1 all langevin ${tStart} ${tStop} ${tdamp} ${langevinSeed}`),
    padCmd("fix", `2 all nph ${p}`),
  ].join("\n");
}

function unfixLines(block: string): string[] {
  const ids = new Set<string>();
  for (const line of block.split("\n")) {
    const m = /^\s*fix\s+(\S+)/.exec(line);
    if (m) ids.add(m[1]);
  }
  return [...ids].sort().map((id) => padCmd("unfix", id));
}

function emitStage(
  stage: EqStage,
  index: number,
  timestep: number,
): string[] {
  const label =
    stage.name?.trim() ||
    `${stage.ensemble.toUpperCase()} T=${stage.tStart}→${stage.tStop}`;
  const lines: string[] = [
    "",
    `# --- eq stage ${index + 1}: ${label} ---`,
  ];
  const nsteps = Math.max(0, Math.floor(stage.nsteps));
  if (stage.ensemble === "nve") {
    lines.push(padCmd("fix", "1 all nve"));
    lines.push(padCmd("run", String(nsteps)));
    lines.push(padCmd("unfix", "1"));
    return lines;
  }
  const common = {
    thermostat: stage.thermostat ?? ("nose-hoover" as Thermostat),
    tStart: stage.tStart,
    tStop: stage.tStop,
    tdamp: defaultTdamp(stage, timestep),
    langevinSeed: stage.langevinSeed ?? derivedLangevinSeed(stage.id),
  };
  let fixBlock: string;
  if (stage.ensemble === "npt") {
    const p0 = stage.pStart ?? 1.0;
    const p1 = stage.pStop ?? p0;
    const pdamp = defaultPdamp(stage, timestep);
    fixBlock = thermoFix({
      ...common,
      ensemble: "npt",
      pArgs: `iso ${p0} ${p1} ${pdamp}`,
    });
  } else {
    fixBlock = thermoFix({ ...common, ensemble: "nvt" });
  }
  lines.push(fixBlock);
  lines.push(padCmd("run", String(nsteps)));
  lines.push(...unfixLines(fixBlock));
  return lines;
}

function emitMinimize(m: MinimizeConfig): string[] {
  const lines = [
    "",
    "# --- minimize ---",
    padCmd("min_style", m.minStyle),
  ];
  if (m.minStyle !== "hftn" && (m.dmax != null || m.norm != null)) {
    lines.push(padCmd("min_modify", `${m.dmax != null ? `dmax ${m.dmax} ` : ""}${m.norm ? `norm ${m.norm}` : ""}`.trim()));
  }
  if (m.minStyle === "fire" && (m.fireIntegrator || m.fireTmax != null)) {
    lines.push(padCmd("min_modify", `${m.fireIntegrator ? `integrator ${m.fireIntegrator} ` : ""}${m.fireTmax != null ? `tmax ${m.fireTmax}` : ""}`.trim()));
  }
  lines.push(padCmd(
      "minimize",
      `${m.etol} ${m.ftol} ${m.maxiter} ${m.maxeval}`,
    ));
  return lines;
}

function emitDump(output: OutputConfig): string[] {
  const lines: string[] = [];
  if (output.dump) {
    const d = output.dump;
    lines.push(
      padCmd("dump", `1 all ${d.style} ${d.every} ${d.path}`),
    );
  }
  if (output.restart) {
    const r = output.restart;
    lines.push(padCmd("restart", `${r.every} ${r.path}`));
  }
  return lines;
}

function emitWriteData(output: OutputConfig): string[] {
  if (!output.writeData) return [];
  return [
    "",
    "# --- final structure ---",
    padCmd("write_data", output.writeData),
  ];
}

/**
 * Pure config → classic LAMMPS input script.
 * T schedule comes from temperature control points (`tempPoints`).
 */
export function generateLammpsEqInput(config: LammpsEqConfig): string {
  const { init, minimize, tempPoints, output } = config;
  const neighbor = init.neighbor ?? {
    skin: init.neighborSkin ?? 2,
    style: "bin" as const,
    every: 1,
    delay: 0,
    check: init.neighborCheck ?? true,
    once: false,
    page: 100000,
    one: 2000,
    binsize: 0,
  };
  const stages = tempPointsToStages(tempPoints);
  const [bx, by, bz] = init.boundary;
  const lines: string[] = [
    `# Generated by ${GENERATOR_TAG}`,
    `# Edit force-field placeholders and pair_coeff for your system.`,
    "",
    padCmd("units", init.units),
    padCmd("atom_style", init.atomStyle),
    padCmd("boundary", `${bx} ${by} ${bz}`),
    "",
    padCmd("read_data", init.dataFile),
    "",
    ...emitForceField(init.forceField),
    "",
    padCmd("neighbor", `${neighbor.skin} ${neighbor.style}`),
    padCmd(
      "neigh_modify",
      `every ${neighbor.every} delay ${neighbor.delay} check ${neighbor.check ? "yes" : "no"} once ${neighbor.once ? "yes" : "no"} page ${neighbor.page} one ${neighbor.one} binsize ${neighbor.binsize}`,
    ),
    padCmd("timestep", String(init.timestep)),
    padCmd("thermo", String(init.thermoEvery)),
    padCmd("thermo_style", init.thermoStyle),
  ];

  const outLines = emitDump(output);
  if (outLines.length > 0) {
    lines.push("", "# --- output ---", ...outLines);
  }

  if (minimize) {
    lines.push(...emitMinimize(minimize));
  }

  if (stages.length === 0) {
    lines.push("", "# (no equilibration stages — add at least 2 temperature points)");
  } else {
    stages.forEach((stage, i) => {
      lines.push(...emitStage(stage, i, init.timestep));
    });
  }

  lines.push(...emitWriteData(output));
  lines.push("");
  return lines.join("\n");
}
