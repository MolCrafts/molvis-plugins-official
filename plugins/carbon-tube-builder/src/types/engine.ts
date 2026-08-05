/**
 * Engine types the plugin contract refers to — **plugin binding**.
 *
 * `contract.ts` is vendored verbatim from the molvis monorepo and must not
 * name a package only the host can resolve, so it imports these four names
 * from here. This file is the one place a plugin repo decides where they
 * come from; `sync-plugin-contract.mjs` never overwrites it.
 *
 * Today that is the published `@molcrafts/molvis-core` surface. When
 * `@molcrafts/molvis-plugin-api` ships, only this file changes.
 */
import type { Modifier, Molvis, Overlay } from "@molcrafts/molvis-core";

export type { Modifier, Molvis, Overlay };

/**
 * Factory for a plugin interaction mode.
 *
 * The host's real signature returns `BaseMode`, which is not reachable from
 * a plugin package. Returning `unknown` here is deliberate: a *narrower*
 * local guess would be a second copy of the engine contract, which is the
 * drift this vendoring exists to stop.
 */
export type PluginModeFactory = (app: Molvis) => unknown;
