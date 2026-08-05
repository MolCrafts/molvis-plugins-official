import { describe, expect, it } from "@rstest/core";
import { generateLammpsEqInput } from "../src/generate/generate";
import { defaultConfig, normalizeConfig } from "../src/model/defaults";
import type { LammpsEqConfig } from "../src/model/types";

function langevinSeeds(script: string): string[] {
  return [...script.matchAll(/fix\s+\S+\s+all langevin \S+ \S+ \S+ (\d+)/g)].map(
    (m) => m[1],
  );
}

function twoLangevinStages(seeds: [number, number]): LammpsEqConfig {
  const config = defaultConfig("real");
  return {
    ...config,
    tempPoints: [
      { ...config.tempPoints[0], thermostat: "langevin" },
      {
        ...config.tempPoints[1],
        thermostat: "langevin",
        langevinSeed: seeds[0],
      },
      {
        ...config.tempPoints[2],
        ensemble: "nvt",
        thermostat: "langevin",
        langevinSeed: seeds[1],
      },
    ],
  };
}

describe("langevin seeds", () => {
  it("emits the seed carried by each control point", () => {
    const script = generateLammpsEqInput(twoLangevinStages([111111, 222222]));
    expect(langevinSeeds(script)).toEqual(["111111", "222222"]);
  });

  it("gives independently created configs different seeds", () => {
    const a = defaultConfig("real").tempPoints[1].langevinSeed;
    const b = defaultConfig("real").tempPoints[1].langevinSeed;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("backfills a seed for drafts saved before the field existed", () => {
    const legacy = defaultConfig("real");
    const stripped = {
      ...legacy,
      tempPoints: legacy.tempPoints.map(({ langevinSeed: _drop, ...p }) => p),
    };
    const migrated = normalizeConfig(stripped);
    expect(migrated).not.toBeNull();
    for (const point of migrated?.tempPoints ?? []) {
      expect(point.langevinSeed).toBeGreaterThan(0);
    }
  });

  it("never reuses one seed across stages when none were stored", () => {
    const legacy = defaultConfig("real");
    const stripped: LammpsEqConfig = {
      ...legacy,
      tempPoints: legacy.tempPoints.map(({ langevinSeed: _drop, ...p }) => ({
        ...p,
        thermostat: "langevin" as const,
        ensemble: "nvt" as const,
      })),
    };
    const seeds = langevinSeeds(generateLammpsEqInput(stripped));
    expect(seeds.length).toBeGreaterThan(1);
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});
