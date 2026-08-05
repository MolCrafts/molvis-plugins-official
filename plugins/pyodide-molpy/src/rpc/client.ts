/**
 * In-page JSON-RPC client for Pyodide → live Molvis app.
 *
 * Same {@link RPCRouter} the WebSocket bridge uses — method names and
 * payloads match CPython `send_cmd("camera.set_pose", …)` /
 * `scene.draw_frame`. No camera field poking, no bespoke scene loaders.
 *
 * Transport is in-process (plugin runs inside the page). The *protocol*
 * is the catalog RPC; the wire is not a second WebSocket hop.
 *
 * molvis-python normally marshals Python values before they reach this module.
 * The boundary still normalizes any remaining PyProxy-like values defensively:
 * nested proxies can otherwise survive a parent `toJs()` conversion and reach
 * the stage as opaque objects (most visibly as missing frame blocks/columns).
 *
 * Stage resolution preference:
 *   1. Host-injected singleton (`__MOLVIS_PLUGIN_HOST_MODULES__`) —
 *      always available after the page plugin loader activates.
 *   2. Dynamic bare import (rewritten by the loader to a host blob URL).
 */

export type RpcCall = (
  method: string,
  params?: Record<string, unknown>,
) => Promise<unknown>;

export interface RpcClient {
  /** Invoke a catalog method (e.g. `camera.set_pose`, `scene.draw_frame`). */
  call: RpcCall;
  /** Bound Molvis app (for kernel re-bind only). */
  readonly app: unknown;
}

type RpcRouterLike = {
  execute: (
    request: unknown,
    buffers?: DataView[],
  ) => Promise<{
    content: {
      result?: unknown;
      error?: { code: number; message: string; data?: unknown };
    };
  }>;
};

type StageApi = {
  RPCRouter: new (app: unknown) => RpcRouterLike;
};

const HOST_KEY = "__MOLVIS_PLUGIN_HOST_MODULES__";

function stageFromHostModules(): StageApi | null {
  const g = globalThis as typeof globalThis & {
    [HOST_KEY]?: Record<string, StageApi | undefined>;
  };
  const host = g[HOST_KEY];
  if (!host) return null;
  for (const spec of ["@molvis/stage", "@molcrafts/molvis-stage"] as const) {
    const mod = host[spec];
    if (mod && typeof mod.RPCRouter === "function") {
      return mod;
    }
  }
  return null;
}

async function importHostStage(): Promise<StageApi> {
  // 1) Prefer host singleton — no bare-specifier resolution, no import maps.
  const injected = stageFromHostModules();
  if (injected) return injected;

  // 2) Fallback: dynamic import. Keep the specifier on the *same* line as
  //    `import(` so the page plugin loader can rewrite it to a host blob URL
  //    (comments/newlines between `import(` and the string break the rewrite).
  try {
    return (await import(/* webpackIgnore: true */ "@molvis/stage")) as StageApi;
  } catch (first) {
    try {
      return (await import(
        /* webpackIgnore: true */ "@molcrafts/molvis-stage"
      )) as StageApi;
    } catch (second) {
      const a = first instanceof Error ? first.message : String(first);
      const b = second instanceof Error ? second.message : String(second);
      throw new Error(
        "Cannot resolve host stage (RPCRouter). " +
          "Expected globalThis.__MOLVIS_PLUGIN_HOST_MODULES__['@molvis/stage'] " +
          `or a loadable bare import. host=${a}; fallback=${b}`,
      );
    }
  }
}

type PyProxyLike = { toJs: () => unknown };

function isPyProxyLike(value: unknown): value is PyProxyLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "toJs" in value &&
    typeof (value as { toJs?: unknown }).toJs === "function"
  );
}

/** Recursively remove PyProxy wrappers without disturbing binary payloads. */
function normalizeRpcValue(
  value: unknown,
  seen = new WeakMap<object, unknown>(),
): unknown {
  if (value === null || typeof value !== "object") return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;

  const cached = seen.get(value);
  if (cached !== undefined) return cached;

  if (isPyProxyLike(value)) {
    const converted = value.toJs();
    // A broken proxy returning itself should not recurse forever.
    if (converted === value) return value;
    const normalized = normalizeRpcValue(converted, seen);
    seen.set(value, normalized);
    return normalized;
  }

  if (Array.isArray(value)) {
    const output: unknown[] = [];
    seen.set(value, output);
    for (const item of value) output.push(normalizeRpcValue(item, seen));
    return output;
  }

  if (value instanceof Map) {
    const output: Record<string, unknown> = {};
    seen.set(value, output);
    for (const [key, item] of value) {
      output[String(key)] = normalizeRpcValue(item, seen);
    }
    return output;
  }

  const output: Record<string, unknown> = {};
  seen.set(value, output);
  for (const [key, item] of Object.entries(value)) {
    output[key] = normalizeRpcValue(item, seen);
  }
  return output;
}

/**
 * Create a client that dispatches JSON-RPC 2.0 requests through the
 * same router WebSocket controllers use.
 */
export function createRpcClient(app: unknown): RpcClient {
  if (!app) {
    throw new Error("createRpcClient: app is required");
  }

  let router: RpcRouterLike | null = null;
  let nextId = 1;

  async function getRouter(): Promise<RpcRouterLike> {
    if (router) return router;
    const stage = await importHostStage();
    if (typeof stage.RPCRouter !== "function") {
      throw new Error(
        "host stage does not export RPCRouter — upgrade molvis page",
      );
    }
    router = new stage.RPCRouter(app);
    return router;
  }

  return {
    app,
    async call(method: string, params: Record<string, unknown> = {}) {
      const r = await getRouter();
      const id = nextId++;
      const normalizedParams = normalizeRpcValue(params ?? {}) as Record<
        string,
        unknown
      >;
      const envelope = await r.execute({
        jsonrpc: "2.0",
        id,
        method,
        params: normalizedParams,
      });
      const { content } = envelope;
      if (content.error) {
        const err = content.error;
        const detail =
          err.data !== undefined ? ` ${JSON.stringify(err.data)}` : "";
        throw new Error(`RPC ${method}: ${err.message}${detail}`);
      }
      return content.result;
    },
  };
}
