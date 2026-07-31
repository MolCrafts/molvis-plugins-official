import { describe, expect, it } from "@rstest/core";
import { createHostBridge } from "../src/bridge/host_bridge";

function mockApp() {
  let alpha = 0.5;
  let beta = 1.0;
  let radius = 20;
  const target = { x: 0, y: 0, z: 0 };
  const position = { x: 10, y: 0, z: 10 };
  const upVector = { x: 0, y: 0, z: 1 };
  let rendered = 0;
  let fitted = false;

  const camera = {
    get alpha() {
      return alpha;
    },
    set alpha(v: number) {
      alpha = v;
    },
    get beta() {
      return beta;
    },
    set beta(v: number) {
      beta = v;
    },
    get radius() {
      return radius;
    },
    set radius(v: number) {
      radius = v;
    },
    position,
    upVector,
    getTarget: () => ({ ...target }),
    setTarget: (t: { x: number; y: number; z: number }) => {
      target.x = t.x;
      target.y = t.y;
      target.z = t.z;
    },
    setPosition: (p: { x: number; y: number; z: number }) => {
      position.x = p.x;
      position.y = p.y;
      position.z = p.z;
    },
    rebuildAnglesAndRadius: () => {
      /* no-op */
    },
  };

  return {
    app: {
      world: {
        camera,
        renderOnce: () => {
          rendered += 1;
        },
        resetCamera: () => {
          fitted = true;
          alpha = Math.PI / 4;
          beta = Math.PI / 3;
        },
      },
    },
    get rendered() {
      return rendered;
    },
    get fitted() {
      return fitted;
    },
  };
}

describe("createHostBridge", () => {
  it("set_pose updates alpha/beta/radius", () => {
    const m = mockApp();
    const bridge = createHostBridge(m.app as never);
    const result = bridge.call("camera.set_pose", {
      alpha: 1.25,
      beta: 0.9,
      radius: 42,
    }) as { pose: { alpha: number; radius: number } };
    expect(result.pose.alpha).toBeCloseTo(1.25);
    expect(result.pose.radius).toBeCloseTo(42);
    expect(m.rendered).toBe(1);
  });

  it("fit_view calls resetCamera", () => {
    const m = mockApp();
    const bridge = createHostBridge(m.app as never);
    bridge.call("camera.fit_view", {});
    expect(m.fitted).toBe(true);
  });

  it("unknown method throws", () => {
    const bridge = createHostBridge(mockApp().app as never);
    expect(() => bridge.call("nope", {})).toThrow(/unknown bridge method/);
  });
});
