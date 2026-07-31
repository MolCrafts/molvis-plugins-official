/**
 * In-process bridge: Pyodide ``stage.camera.*`` → live Molvis app.
 *
 * Prefer stage's exported camera helpers when available; fall back to
 * direct ``app.world.camera`` mutation so the plugin works against older
 * published @molcrafts/molvis-core builds.
 */

import type { Molvis } from "@molcrafts/molvis-core";

export type BridgeCallResult = unknown;

export interface HostBridge {
  call(method: string, params?: Record<string, unknown>): BridgeCallResult;
}

type Cam = {
  alpha: number;
  beta: number;
  radius: number;
  position: { x: number; y: number; z: number };
  upVector: { x: number; y: number; z: number };
  getTarget: () => { x: number; y: number; z: number };
  setTarget: (v: { x: number; y: number; z: number }) => void;
  setPosition?: (v: { x: number; y: number; z: number }) => void;
  rebuildAnglesAndRadius?: () => void;
};

function asApp(app: Molvis): {
  world: {
    camera: Cam;
    renderOnce?: () => void;
    resetCamera?: (opts?: { viewDirection?: string }) => void;
  };
  resetCamera?: () => void;
} {
  return app as unknown as {
    world: {
      camera: Cam;
      renderOnce?: () => void;
      resetCamera?: (opts?: { viewDirection?: string }) => void;
    };
    resetCamera?: () => void;
  };
}

function poseOf(cam: Cam) {
  const t = cam.getTarget();
  return {
    alpha: cam.alpha,
    beta: cam.beta,
    radius: cam.radius,
    target: [t.x, t.y, t.z] as [number, number, number],
    position: [cam.position.x, cam.position.y, cam.position.z] as [
      number,
      number,
      number,
    ],
    up: [cam.upVector.x, cam.upVector.y, cam.upVector.z] as [
      number,
      number,
      number,
    ],
  };
}

function render(app: ReturnType<typeof asApp>): void {
  try {
    app.world.renderOnce?.();
  } catch {
    /* headless / missing */
  }
}

/**
 * Build a host bridge bound to the plugin's Molvis app instance.
 */
export function createHostBridge(app: Molvis | null): HostBridge {
  return {
    call(method: string, params: Record<string, unknown> = {}): BridgeCallResult {
      if (!app) {
        throw new Error("molvis app is not available");
      }
      const a = asApp(app);
      const cam = a.world.camera;
      if (!cam) {
        throw new Error("world.camera is not available");
      }

      switch (method) {
        case "camera.get_pose":
          return poseOf(cam);

        case "camera.set_pose": {
          if (typeof params.alpha === "number") cam.alpha = params.alpha;
          if (typeof params.beta === "number") cam.beta = params.beta;
          if (typeof params.radius === "number") {
            cam.radius = Math.max(0.01, params.radius);
          }
          if (Array.isArray(params.target) && params.target.length >= 3) {
            const t = params.target as number[];
            cam.setTarget({ x: t[0], y: t[1], z: t[2] });
          }
          cam.rebuildAnglesAndRadius?.();
          render(a);
          return { pose: poseOf(cam) };
        }

        case "camera.look_at": {
          const position = params.position as number[] | undefined;
          const target = params.target as number[] | undefined;
          if (!position || !target || position.length < 3 || target.length < 3) {
            throw new Error("look_at requires position and target length-3 arrays");
          }
          if (Array.isArray(params.up) && (params.up as number[]).length >= 3) {
            const u = params.up as number[];
            cam.upVector = { x: u[0], y: u[1], z: u[2] };
          }
          cam.setTarget({ x: target[0], y: target[1], z: target[2] });
          if (cam.setPosition) {
            cam.setPosition({
              x: position[0],
              y: position[1],
              z: position[2],
            });
          } else {
            cam.position.x = position[0];
            cam.position.y = position[1];
            cam.position.z = position[2];
          }
          cam.rebuildAnglesAndRadius?.();
          render(a);
          return { pose: poseOf(cam) };
        }

        case "camera.fit_view": {
          if (a.world.resetCamera) {
            a.world.resetCamera({ viewDirection: "iso" });
          } else {
            a.resetCamera?.();
          }
          render(a);
          return { pose: poseOf(cam) };
        }

        default:
          throw new Error(`unknown bridge method: ${method}`);
      }
    },
  };
}
