import { describe, expect, it } from "@rstest/core";
import {
  lerpSchedule,
  tempPointsToSchedulePoints,
  tempPointsToStages,
} from "../src/model/schedule";
import type { TempControlPoint } from "../src/model/types";

const sample: TempControlPoint[] = [
  {
    id: "a",
    step: 0,
    temperature: 100,
    ensemble: "nvt",
  },
  {
    id: "b",
    step: 1000,
    temperature: 300,
    ensemble: "nvt",
    thermostat: "nose-hoover",
  },
  {
    id: "c",
    step: 3000,
    temperature: 300,
    ensemble: "npt",
    pStart: 1,
    pStop: 1,
  },
];

describe("tempPointsToSchedulePoints", () => {
  it("maps temperature points to polyline vertices", () => {
    expect(tempPointsToSchedulePoints(sample)).toEqual([
      { x: 0, y: 100 },
      { x: 1000, y: 300 },
      { x: 3000, y: 300 },
    ]);
  });

  it("returns a zero point for empty list", () => {
    expect(tempPointsToSchedulePoints([])).toEqual([{ x: 0, y: 0 }]);
  });
});

describe("tempPointsToStages", () => {
  it("derives segments between consecutive points", () => {
    const stages = tempPointsToStages(sample);
    expect(stages).toHaveLength(2);
    expect(stages[0]).toMatchObject({
      tStart: 100,
      tStop: 300,
      nsteps: 1000,
      ensemble: "nvt",
    });
    expect(stages[1]).toMatchObject({
      tStart: 300,
      tStop: 300,
      nsteps: 2000,
      ensemble: "npt",
    });
  });
});

describe("lerpSchedule", () => {
  it("interpolates midway between schedules", () => {
    const from = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    const to = [
      { x: 0, y: 100 },
      { x: 10, y: 200 },
    ];
    expect(lerpSchedule(from, to, 0.5)).toEqual([
      { x: 0, y: 50 },
      { x: 10, y: 105 },
    ]);
  });

  it("returns target at t=1", () => {
    const to = [{ x: 1, y: 2 }];
    expect(lerpSchedule([{ x: 0, y: 0 }], to, 1)).toEqual([{ x: 1, y: 2 }]);
  });
});
