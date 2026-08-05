import { describe, expect, it } from "@rstest/core";
import { defaultConfig, defaultInit, withUnits } from "../src/model/defaults";
import { UNIT_SYSTEM_DEFAULTS } from "../src/model/unit_systems";

describe("unit-system defaults", () => {
  it("gives every LAMMPS unit system its own timestep and neighbor skin", () => {
    expect(UNIT_SYSTEM_DEFAULTS.real.timestep).toBe(1.0);
    expect(UNIT_SYSTEM_DEFAULTS.metal.timestep).toBe(0.001);
    expect(UNIT_SYSTEM_DEFAULTS.lj.timestep).toBe(0.005);
    expect(UNIT_SYSTEM_DEFAULTS.lj.neighborSkin).toBe(0.3);
    expect(UNIT_SYSTEM_DEFAULTS.lj.temperature).toBe(1.0);
  });

  it("derives defaultInit from the selected unit system", () => {
    expect(defaultInit("metal").timestep).toBe(0.001);
    expect(defaultInit("real").timestep).toBe(1.0);
  });

  it("re-derives timestep and skin when the unit system changes", () => {
    const real = defaultInit("real");
    const metal = withUnits(real, "metal");
    expect(metal.units).toBe("metal");
    expect(metal.timestep).toBe(0.001);
    expect(metal.neighborSkin).toBe(2.0);
    // Unit-independent fields survive the switch.
    expect(metal.dataFile).toBe(real.dataFile);
    expect(metal.atomStyle).toBe(real.atomStyle);
  });

  it("scales damping constants with the unit system's timestep", () => {
    const real = defaultConfig("real").tempPoints[1];
    const metal = defaultConfig("metal").tempPoints[1];
    expect(real.tdamp).toBe(100);
    expect(metal.tdamp).toBeCloseTo(0.1, 12);
  });
});
