/**
 * Circle-stack physics for the reaction chamber.
 *
 * The old integrator applied a restitution impulse on every collision
 * iteration (five times per tick) and used a floor-rest threshold smaller
 * than one gravity step, so a packed pile never went still. Sleeping bodies
 * are static supports; the game wakes a neighborhood only when the stack
 * actually changes (merge, decay, compress). The velocity solve runs once
 * per tick.
 */
export const FIXED_STEP = 1 / 120;
export const GRAVITY = 760;
export const BODY_RESTITUTION = 0.11;
export const WALL_RESTITUTION = 0.1;
export const FLOOR_RESTITUTION = 0.07;
export const POSITION_SLOP = 0.22;
export const POSITION_PERCENT = 0.52;
export const COLLISION_ITERATIONS = 6;
export const SLEEP_SPEED = 26;
export const RESTING_APPROACH = 42;
export const FLOOR_FRICTION = 0.86;
export const AIR_DAMP_X = 0.992;
export const AIR_DAMP_Y = 0.995;
export const SUPPORT_GAP = 1.7;

export interface PhysicsBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  sleeping: boolean;
}

export function isSleepingSpeed(vx: number, vy: number): boolean {
  return vx * vx + vy * vy < SLEEP_SPEED * SLEEP_SPEED;
}

export function overlapCorrection(overlap: number): number {
  return Math.max(0, overlap - POSITION_SLOP) * POSITION_PERCENT;
}

export function contactRestitution(closingSpeed: number): number {
  return closingSpeed < RESTING_APPROACH ? 0 : BODY_RESTITUTION;
}

export class ChamberPhysics {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  integrate(body: PhysicsBody, dt: number): void {
    if (body.sleeping) return;
    body.vy += GRAVITY * dt;
    body.vx *= AIR_DAMP_X;
    body.vy *= AIR_DAMP_Y;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }

  resolveBounds(body: PhysicsBody): void {
    if (body.x - body.radius < 0) {
      body.x = body.radius;
      this.bounceAxis(body, "vx", 1);
    } else if (body.x + body.radius > this.width) {
      body.x = this.width - body.radius;
      this.bounceAxis(body, "vx", -1);
    }

    if (body.y + body.radius > this.height) {
      body.y = this.height - body.radius;
      if (body.sleeping) {
        body.vy = 0;
        return;
      }
      if (body.vy > 0) {
        body.vy =
          body.vy < SLEEP_SPEED ? 0 : -body.vy * FLOOR_RESTITUTION;
      }
      body.vx *= FLOOR_FRICTION;
      if (Math.abs(body.vx) < 4) body.vx = 0;
    }
  }

  /**
   * Separates two overlapping circles. The velocity impulse runs only when
   * `applyImpulse` is true — later iterations are position-only so a resting
   * pile does not accumulate bounce energy.
   *
   * @returns Closing speed when an impulse is applied, otherwise 0.
   */
  collide(
    left: PhysicsBody,
    right: PhysicsBody,
    applyImpulse: boolean,
  ): number {
    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const minimumDistance = left.radius + right.radius;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= minimumDistance * minimumDistance) return 0;

    const distance = Math.sqrt(Math.max(1e-4, distanceSquared));
    const nx = dx / distance;
    const ny = dy / distance;
    const masses = this.inverseMasses(left, right);
    const correction = overlapCorrection(minimumDistance - distance);
    if (correction > 0) {
      left.x -= nx * correction * masses.leftShare;
      left.y -= ny * correction * masses.leftShare;
      right.x += nx * correction * masses.rightShare;
      right.y += ny * correction * masses.rightShare;
    }

    if (!applyImpulse) return 0;

    const relativeX = right.vx - left.vx;
    const relativeY = right.vy - left.vy;
    const normalSpeed = relativeX * nx + relativeY * ny;
    if (normalSpeed >= 0) return 0;

    const closingSpeed = -normalSpeed;
    const live = this.inverseMasses(left, right);
    const impulse =
      (-(1 + contactRestitution(closingSpeed)) * normalSpeed) / live.total;
    left.vx -= impulse * nx * live.left;
    left.vy -= impulse * ny * live.left;
    right.vx += impulse * nx * live.right;
    right.vy += impulse * ny * live.right;

    const tangentX = -ny;
    const tangentY = nx;
    const tangentSpeed = relativeX * tangentX + relativeY * tangentY;
    const frictionLimit = Math.abs(impulse) * 0.18;
    const frictionImpulse = Math.max(
      -frictionLimit,
      Math.min(frictionLimit, -tangentSpeed / live.total),
    );
    left.vx -= frictionImpulse * tangentX * live.left;
    left.vy -= frictionImpulse * tangentY * live.left;
    right.vx += frictionImpulse * tangentX * live.right;
    right.vy += frictionImpulse * tangentY * live.right;

    return closingSpeed;
  }

  settle(bodies: readonly PhysicsBody[]): void {
    const ordered = [...bodies].sort((left, right) => right.y - left.y);
    for (const body of ordered) {
      if (body.sleeping) continue;
      if (!isSleepingSpeed(body.vx, body.vy)) continue;
      if (!this.isSupported(body, bodies)) continue;
      body.vx = 0;
      body.vy = 0;
      body.sleeping = true;
    }
  }

  wakeNear(
    bodies: readonly PhysicsBody[],
    x: number,
    y: number,
    reach: number,
  ): void {
    const reachSquared = reach * reach;
    for (const body of bodies) {
      const dx = body.x - x;
      const dy = body.y - y;
      if (dx * dx + dy * dy <= reachSquared) body.sleeping = false;
    }
  }

  private bounceAxis(
    body: PhysicsBody,
    axis: "vx" | "vy",
    outwardSign: number,
  ): void {
    if (body.sleeping) {
      body[axis] = 0;
      return;
    }
    const speed = body[axis] * -outwardSign;
    if (speed <= 0) return;
    body[axis] = speed < SLEEP_SPEED ? 0 : outwardSign * speed * WALL_RESTITUTION;
  }

  private inverseMasses(
    left: PhysicsBody,
    right: PhysicsBody,
  ): {
    left: number;
    right: number;
    total: number;
    leftShare: number;
    rightShare: number;
  } {
    const leftStatic = left.sleeping && !right.sleeping;
    const rightStatic = right.sleeping && !left.sleeping;
    const leftInv = leftStatic ? 0 : 1 / left.mass;
    const rightInv = rightStatic ? 0 : 1 / right.mass;
    const liveLeft = leftInv + rightInv === 0 ? 1 / left.mass : leftInv;
    const liveRight = leftInv + rightInv === 0 ? 1 / right.mass : rightInv;
    const liveTotal = liveLeft + liveRight;
    return {
      left: liveLeft,
      right: liveRight,
      total: liveTotal,
      leftShare: liveLeft / liveTotal,
      rightShare: liveRight / liveTotal,
    };
  }

  private isSupported(
    body: PhysicsBody,
    bodies: readonly PhysicsBody[],
  ): boolean {
    if (body.y + body.radius >= this.height - 1.2) return true;
    for (const other of bodies) {
      if (other === body) continue;
      const dx = other.x - body.x;
      const dy = other.y - body.y;
      if (dy <= 0.4) continue;
      const distance = Math.hypot(dx, dy);
      const gap = distance - (body.radius + other.radius);
      if (gap > SUPPORT_GAP) continue;
      const supported =
        other.sleeping || isSleepingSpeed(other.vx, other.vy);
      if (supported && dy / Math.max(distance, 1e-4) > 0.22) return true;
    }
    return false;
  }
}
