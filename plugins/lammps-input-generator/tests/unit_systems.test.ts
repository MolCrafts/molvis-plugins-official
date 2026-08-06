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
    // `real` and `metal` happen to share a 2.0 skin, so switching between
    // them cannot show whether the skin was re-derived or merely carried
    // over. `nano` (10.0) is the pair that makes this assertion bite.
    const real = defaultInit("real");
    expect(real.neighbor?.skin).toBe(2.0);

    const nano = withUnits(real, "nano");
    expect(nano.units).toBe("nano");
    expect(nano.timestep).toBe(0.00045);
    expect(nano.neighbor?.skin).toBe(10.0);
    // Unit-independent fields survive the switch.
    expect(nano.dataFile).toBe(real.dataFile);
    expect(nano.atomStyle).toBe(real.atomStyle);
  });

  it("scales damping constants with the unit system's timestep", () => {
    const real = defaultConfig("real").tempPoints[1];
    const metal = defaultConfig("metal").tempPoints[1];
    expect(real.tdamp).toBe(100);
    expect(metal.tdamp).toBeCloseTo(0.1, 12);
  });
});
