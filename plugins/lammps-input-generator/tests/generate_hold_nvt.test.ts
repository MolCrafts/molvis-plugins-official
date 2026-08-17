import { describe, expect, it } from "@rstest/core";
import { generateLammpsEqInput } from "../src/generate/generate";
import type { LammpsEqConfig } from "../src/model/types";

function holdNvtConfig(): LammpsEqConfig {
  return {
    init: {
      units: "real",
      atomStyle: "full",
      boundary: ["p", "p", "p"],
      dataFile: "data.lmp",
      timestep: 1.0,
      thermoEvery: 1000,
      thermoStyle: "custom step temp pe ke etotal press vol",
      neighbor: {
        skin: 2.0,
        style: "bin",
        every: 1,
        delay: 0,
        check: true,
        once: false,
        page: 100000,
        one: 2000,
        binsize: 0,
      },
      forceField: {
        pairStyle: "lj/cut/coul/long 12.0",
        pairCoeff: "* * 0.1 3.5",
        lines: [
          { id: "ff-1", kind: "bond_style", text: "bond_style     harmonic" },
          {
            id: "ff-2",
            kind: "kspace_style",
            text: "kspace_style   pppm 1.0e-4",
          },
        ],
      },
    },
    minimize: null,
    tempPoints: [
      {
        id: "p0",
        name: "start",
        step: 0,
        temperature: 300,
        ensemble: "nvt",
      },
      {
        id: "p1",
        name: "NVT hold",
        step: 50_000,
        temperature: 300,
        ensemble: "nvt",
        thermostat: "nose-hoover",
        tdamp: 100,
      },
    ],
    output: {
      dump: null,
      restart: null,
      writeData: null,
    },
  };
}

describe("generateLammpsEqInput hold NVT", () => {
  it("emits units, read_data, FF placeholders, and nvt fix from temperature points", () => {
    const script = generateLammpsEqInput(holdNvtConfig());
    expect(script).toContain("units           real");
    expect(script).toContain("read_data       data.lmp");
    expect(script).toContain(
      "# --- force field (placeholders — edit for your system) ---",
    );
    expect(script).toContain("pair_style      lj/cut/coul/long 12.0");
    expect(script).toContain("pair_coeff      * * 0.1 3.5");
    expect(script).toContain("# --- force-field lines ---");
    expect(script).toContain("bond_style     harmonic");
    expect(script).toContain("kspace_style   pppm 1.0e-4");
    expect(script).toContain("neighbor        2 bin");
    expect(script).toContain("thermo          1000");
    expect(script).toContain("# --- eq stage 1: NVT hold ---");
    expect(script).toContain(
      "fix             1 all nvt temp 300 300 100",
    );
    expect(script).toContain("run             50000");
    expect(script).toContain("unfix           1");
    expect(script).not.toContain("minimize");
  });
});
