import { describe, expect, it } from "@rstest/core";
import { createRpcClient } from "../src/rpc/client";

describe("createRpcClient", () => {
  it("requires an app", () => {
    expect(() => createRpcClient(null)).toThrow(/app is required/);
  });

  it("exposes call and app", () => {
    const app = { id: "mock" };
    const client = createRpcClient(app);
    expect(client.app).toBe(app);
    expect(typeof client.call).toBe("function");
  });

  it("converts PyProxy-like params via toJs before RPC execute", async () => {
    const calls: unknown[] = [];
    const execute = async (req: unknown) => {
      calls.push(req);
      return { content: { result: { ok: true } } };
    };
    const hostKey = "__MOLVIS_PLUGIN_HOST_MODULES__";
    const g = globalThis as typeof globalThis & {
      [hostKey]?: Record<string, unknown>;
    };
    const prev = g[hostKey];
    g[hostKey] = {
      "@molcrafts/molvis-stage": {
        RPCRouter: class {
          execute = execute;
        },
      },
    };
    try {
      const client = createRpcClient({ id: "mock" });
      // Simulate a Pyodide PyProxy: has toJs(), is not Array.isArray.
      const pyList = {
        toJs: () => [0.0, 1.0, 2.0],
      };
      const pyFrame = {
        toJs: () => ({
          blocks: {
            atoms: {
              x: [0.0, 1.0],
              y: [0.0, 0.0],
              z: pyList,
            },
          },
        }),
      };
      await client.call("scene.draw_frame", {
        frame: pyFrame as unknown as Record<string, unknown>,
      });
      expect(calls.length).toBe(1);
      const req = calls[0] as {
        method: string;
        params: { frame: { blocks: { atoms: { z: unknown } } } };
      };
      expect(req.method).toBe("scene.draw_frame");
      // Nested toJs on z → real Array for stage assignColumn.
      const z = req.params.frame.blocks.atoms.z;
      expect(Array.isArray(z)).toBe(true);
      expect(z).toEqual([0.0, 1.0, 2.0]);
    } finally {
      if (prev === undefined) delete g[hostKey];
      else g[hostKey] = prev;
    }
  });
});
