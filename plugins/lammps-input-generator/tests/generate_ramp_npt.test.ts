import { describe, expect, it } from "@rstest/core";
import { generateLammpsEqInput } from "../src/generate/generate";
import type { LammpsEqConfig } from "../src/model/types";

function rampNptConfig(): LammpsEqConfig {
  return {
    init: {
      units: "metal",
      atomStyle: "atomic",
      boundary: ["p", "p", "p"],
      dataFile: "system.data",
      timestep: 0.001,
      thermoEvery: 100,
      thermoStyle: "custom step temp press pe",
      neighbor: {
        skin: 1.0,
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
        pairStyle: "eam/alloy",
        pairCoeff: "* * Cu.eam.alloy Cu",
        lines: [
          { id: "ff-x", kind: "custom", text: "neighbor_modify delay 0" },
        ],
      },
    },
    minimize: {
      etol: 1e-4,
      ftol: 1e-6,
      maxiter: 1000,
      maxeval: 10000,
      minStyle: "cg",
    },
    tempPoints: [
      {
        id: "p0",
        step: 0,
        temperature: 100,
        ensemble: "nvt",
      },
      {
        id: "p1",
        name: "heat",
        step: 20_000,
        temperature: 300,
        ensemble: "nvt",
        thermostat: "nose-hoover",
        tdamp: 0.1,
      },
      {
        id: "p2",
        name: "NPT",
        step: 60_000,
        temperature: 300,
        ensemble: "npt",
        thermostat: "nose-hoover",
        pStart: 0,
        pStop: 1,
        tdamp: 0.1,
        pdamp: 1.0,
      },
    ],
    output: {
      dump: {
        every: 1000,
        path: "dump.eq.lammpstrj",
        style: "custom id type x y z",
      },
      restart: {
        every: 5000,
        path: "restart.eq",
      },
      writeData: "data.eq.lmp",
    },
  };
}

describe("generateLammpsEqInput ramp + NPT", () => {
  it("emits minimize, T ramp, npt iso, dump/restart/write_data", () => {
    const script = generateLammpsEqInput(rampNptConfig());
    expect(script).toContain("units           metal");
    expect(script).toContain("pair_style      eam/alloy");
    expect(script).toContain("pair_coeff      * * Cu.eam.alloy Cu");
    expect(script).toContain("neighbor_modify delay 0");
    expect(script).not.toContain("# bond_style");
    expect(script).toContain("min_style       cg");
    expect(script).toContain("minimize        0.0001 0.000001 1000 10000");
    expect(script).toContain(
      "fix             1 all nvt temp 100 300 0.1",
    );
    expect(script).toContain(
      "fix             1 all npt temp 300 300 0.1 iso 0 1 1",
    );
    expect(script).toContain(
      "dump            1 all custom id type x y z 1000 dump.eq.lammpstrj",
    );
    expect(script).toContain("restart         5000 restart.eq");
    expect(script).toContain("write_data      data.eq.lmp");
  });
});
