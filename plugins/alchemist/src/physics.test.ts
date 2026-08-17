import { describe, expect, test } from "@rstest/core";
import {
  ChamberPhysics,
  COLLISION_ITERATIONS,
  FIXED_STEP,
  contactRestitution,
  isSleepingSpeed,
  overlapCorrection,
  type PhysicsBody,
} from "./physics";

function ball(
  x: number,
  y: number,
  radius: number,
  extras: Partial<PhysicsBody> = {},
): PhysicsBody {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    radius,
    mass: radius * radius,
    sleeping: false,
    ...extras,
  };
}

function stepPile(
  physics: ChamberPhysics,
  bodies: PhysicsBody[],
  seconds: number,
): void {
  const steps = Math.round(seconds / FIXED_STEP);
  for (let step = 0; step < steps; step += 1) {
    for (const body of bodies) {
      physics.integrate(body, FIXED_STEP);
      physics.resolveBounds(body);
    }
    for (let iteration = 0; iteration < COLLISION_ITERATIONS; iteration += 1) {
      for (let left = 0; left < bodies.length; left += 1) {
        for (let right = left + 1; right < bodies.length; right += 1) {
          const a = bodies[left];
          const b = bodies[right];
          if (!a || !b) continue;
          physics.collide(a, b, iteration === 0);
        }
      }
    }
    physics.settle(bodies);
  }
}

function kineticEnergy(bodies: readonly PhysicsBody[]): number {
  return bodies.reduce(
    (sum, body) => sum + 0.5 * body.mass * (body.vx * body.vx + body.vy * body.vy),
    0,
  );
}

describe("contact policy", () => {
  test("ignores overlap inside the slop band", () => {
    expect(overlapCorrection(0.1)).toBe(0);
    expect(overlapCorrection(1)).toBeGreaterThan(0.3);
  });

  test("kills bounce on a resting approach", () => {
    expect(contactRestitution(10)).toBe(0);
    expect(contactRestitution(80)).toBeGreaterThan(0);
  });

  test("classifies sleep from speed, not from a single axis", () => {
    expect(isSleepingSpeed(0, 0)).toBe(true);
    expect(isSleepingSpeed(80, 0)).toBe(false);
  });
});

describe("ChamberPhysics", () => {
  test("a sleeping body on the floor does not drift under gravity", () => {
    const physics = new ChamberPhysics(200, 300);
    const body = ball(80, 280, 20, { sleeping: true });
    stepPile(physics, [body], 1);
    expect(body.y).toBe(280);
    expect(body.vy).toBe(0);
    expect(body.sleeping).toBe(true);
  });

  test("a packed pile goes still instead of jittering", () => {
    const physics = new ChamberPhysics(200, 300);
    const radius = 22;
    const bodies = [
      ball(50, 40, radius),
      ball(95, 40, radius),
      ball(140, 40, radius),
      ball(72, 90, radius),
      ball(118, 90, radius),
      ball(95, 140, radius),
      ball(50, 90, radius),
      ball(140, 90, radius),
    ];
    stepPile(physics, bodies, 2.4);
    expect(kineticEnergy(bodies)).toBeLessThan(80);
    expect(
      bodies.every(
        (body) => body.sleeping || isSleepingSpeed(body.vx, body.vy),
      ),
    ).toBe(true);
    expect(
      bodies.every((body) => body.y + body.radius <= 300 + 0.05),
    ).toBe(true);
  });

  test("a landing ball rests on a sleeper without shaking it", () => {
    const physics = new ChamberPhysics(200, 300);
    const floor = ball(100, 280, 20, { sleeping: true });
    const falling = ball(100, 60, 20, { vy: 420 });
    stepPile(physics, [floor, falling], 1.1);
    expect(floor.sleeping).toBe(true);
    expect(floor.x).toBeCloseTo(100, 5);
    expect(floor.y).toBeCloseTo(280, 5);
    expect(kineticEnergy([floor, falling])).toBeLessThan(40);
  });

  test("wakeNear only unsleeps bodies inside the reach", () => {
    const physics = new ChamberPhysics(200, 300);
    const near = ball(40, 40, 16, { sleeping: true });
    const far = ball(180, 260, 16, { sleeping: true });
    physics.wakeNear([near, far], 40, 40, 24);
    expect(near.sleeping).toBe(false);
    expect(far.sleeping).toBe(true);
  });
});
