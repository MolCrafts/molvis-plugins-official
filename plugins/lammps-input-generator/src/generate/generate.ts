import { tempPointsToStages } from "../model/schedule";
import type {
  EqStage,
  ForceFieldPlaceholders,
  LammpsEqConfig,
  MinimizeConfig,
  OutputConfig,
  Thermostat,
} from "../model/types";

const GENERATOR_TAG =
  "molvis-plugins-official / lammps-input-generator v0.1.0";

const COMMENTED_FF_STUBS = [
  "# bond_style     harmonic",
  "# bond_coeff     1 300.0 1.0",
  "# angle_style    harmonic",
  "# angle_coeff    1 50.0 109.5",
  "# dihedral_style opls",
  "# dihedral_coeff 1 0.0 0.0 0.0 0.0",
  "# improper_style cvff",
  "# improper_coeff 1 20.0  -1  2",
  "# kspace_style   pppm 1.0e-4",
  "# special_bonds  lj/coul 0.0 0.0 0.5",
];

function padCmd(cmd: string, args: string): string {
  return `${cmd.padEnd(16)}${args}`.trimEnd();
}

function emitForceField(ff: ForceFieldPlaceholders): string[] {
  const lines: string[] = [
    "# --- force field (placeholders — edit for your system) ---",
    padCmd("pair_style", ff.pairStyle),
    padCmd("pair_coeff", ff.pairCoeff),
  ];
  const extra = ff.extraLines.split("\n").map((l) => l.trimEnd());
  const hasExtra = extra.some((l) => l.trim() !== "");
  if (hasExtra) {
    lines.push("# --- extra force-field lines ---");
    for (const l of extra) {
      if (l.trim() === "" && lines[lines.length - 1] === "") continue;
      lines.push(l);
    }
  }
  if (ff.includeCommentedStubs) {
    lines.push("# --- optional FF stubs (uncomment / edit as needed) ---");
    lines.push(...COMMENTED_FF_STUBS);
  }
  return lines;
}

function defaultTdamp(stage: EqStage, timestep: number): number {
  if (stage.tdamp != null && stage.tdamp > 0) return stage.tdamp;
  return Math.max(timestep * 100, 1);
}

function defaultPdamp(stage: EqStage, timestep: number): number {
  if (stage.pdamp != null && stage.pdamp > 0) return stage.pdamp;
  return Math.max(timestep * 1000, 1);
}

function thermoFix(
  ensemble: "nvt" | "npt",
  thermostat: Thermostat,
  tStart: number,
  tStop: number,
  tdamp: number,
  pArgs?: string,
): string {
  if (ensemble === "nvt") {
    if (thermostat === "nose-hoover") {
      return padCmd("fix", `1 all nvt temp ${tStart} ${tStop} ${tdamp}`);
    }
    if (thermostat === "berendsen") {
      return [
        padCmd(
          "fix",
          `1 all temp/berendsen ${tStart} ${tStop} ${tdamp}`,
        ),
        padCmd("fix", "2 all nve"),
      ].join("\n");
    }
    return [
      padCmd(
        "fix",
        `1 all langevin ${tStart} ${tStop} ${tdamp} 48279`,
      ),
      padCmd("fix", "2 all nve"),
    ].join("\n");
  }
  const p = pArgs ?? "iso 1.0 1.0 1000";
  if (thermostat === "nose-hoover") {
    return padCmd(
      "fix",
      `1 all npt temp ${tStart} ${tStop} ${tdamp} ${p}`,
    );
  }
  if (thermostat === "berendsen") {
    const pressPart = p.replace(/^iso\s+/, "");
    return [
      padCmd(
        "fix",
        `1 all temp/berendsen ${tStart} ${tStop} ${tdamp}`,
      ),
      padCmd("fix", `2 all press/berendsen iso ${pressPart}`),
      padCmd("fix", "3 all nve"),
    ].join("\n");
  }
  return [
    padCmd(
      "fix",
      `1 all langevin ${tStart} ${tStop} ${tdamp} 48279`,
    ),
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
  const thermostat: Thermostat = stage.thermostat ?? "nose-hoover";
  const tdamp = defaultTdamp(stage, timestep);
  let pArgs: string | undefined;
  if (stage.ensemble === "npt") {
    const p0 = stage.pStart ?? 1.0;
    const p1 = stage.pStop ?? p0;
    const pdamp = defaultPdamp(stage, timestep);
    pArgs = `iso ${p0} ${p1} ${pdamp}`;
  }
  const fixBlock = thermoFix(
    stage.ensemble,
    thermostat,
    stage.tStart,
    stage.tStop,
    tdamp,
    pArgs,
  );
  lines.push(fixBlock);
  lines.push(padCmd("run", String(nsteps)));
  lines.push(...unfixLines(fixBlock));
  return lines;
}

function emitMinimize(m: MinimizeConfig): string[] {
  return [
    "",
    "# --- minimize ---",
    padCmd("min_style", m.minStyle),
    padCmd(
      "minimize",
      `${m.etol} ${m.ftol} ${m.maxiter} ${m.maxeval}`,
    ),
  ];
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
 * T schedule comes from 调温点 (`tempPoints`); FF block is placeholders.
 */
export function generateLammpsEqInput(config: LammpsEqConfig): string {
  const { init, minimize, tempPoints, output } = config;
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
    padCmd("neighbor", `${init.neighborSkin} bin`),
    padCmd(
      "neigh_modify",
      `every 1 delay 0 check ${init.neighborCheck ? "yes" : "no"}`,
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
    lines.push("", "# (no equilibration stages — add ≥2 调温点)");
  } else {
    stages.forEach((stage, i) => {
      lines.push(...emitStage(stage, i, init.timestep));
    });
  }

  lines.push(...emitWriteData(output));
  lines.push("");
  return lines.join("\n");
}
