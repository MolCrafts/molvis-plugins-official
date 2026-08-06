import type {
  EqStage,
  SchedulePoint,
  TempControlPoint,
} from "./types";

/** Sort control points by step (stable for ties). */
export function sortTempPoints(points: TempControlPoint[]): TempControlPoint[] {
  return [...points].sort((a, b) => a.step - b.step || a.id.localeCompare(b.id));
}

/**
 * Piecewise-linear T schedule for molplot: one vertex per control point.
 */
export function tempPointsToSchedulePoints(
  points: TempControlPoint[],
): SchedulePoint[] {
  const sorted = sortTempPoints(points);
  if (sorted.length === 0) return [{ x: 0, y: 0 }];
  return sorted.map((p) => ({ x: p.step, y: p.temperature }));
}

/**
 * Derive LAMMPS run stages between consecutive control points.
 * Point 0 is the origin; segment i runs from point[i] → point[i+1].
 */
export function tempPointsToStages(points: TempControlPoint[]): EqStage[] {
  const sorted = sortTempPoints(points);
  if (sorted.length < 2) return [];
  const stages: EqStage[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const nsteps = Math.max(0, Math.floor(cur.step - prev.step));
    stages.push({
      id: cur.id,
      name: cur.name,
      ensemble: cur.ensemble,
      thermostat: cur.thermostat,
      tStart: prev.temperature,
      tStop: cur.temperature,
      nsteps,
      pStart: cur.pStart,
      pStop: cur.pStop,
      tdamp: cur.tdamp,
      pdamp: cur.pdamp,
      langevinSeed: cur.langevinSeed,
    });
  }
  return stages;
}

/** Linear interpolation of schedule points (for chart tween animation). */
export function lerpSchedule(
  from: SchedulePoint[],
  to: SchedulePoint[],
  t: number,
): SchedulePoint[] {
  const u = Math.min(1, Math.max(0, t));
  // Result length follows the longer series, padding the shorter one by
  // holding its last sample. (A first loop used to build a full `out` array
  // that every return path below then ignored — dead work, removed.)
  if (u >= 1) return to.map((p) => ({ ...p }));
  if (to.length >= from.length) {
    return to.map((b, i) => {
      const a = from[Math.min(i, from.length - 1)] ?? b;
      return {
        x: a.x + (b.x - a.x) * u,
        y: a.y + (b.y - a.y) * u,
      };
    });
  }
  return from.map((a, i) => {
    const b = to[Math.min(i, to.length - 1)] ?? a;
    return {
      x: a.x + (b.x - a.x) * u,
      y: a.y + (b.y - a.y) * u,
    };
  });
}
