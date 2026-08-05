/**
 * Host-provided module specifiers.
 *
 * `@molvis/stage` (and its legacy `@molcrafts/molvis-stage` spelling) is never
 * installed from npm — the MolVis page loader registers the engine on
 * `globalThis.__MOLVIS_PLUGIN_HOST_MODULES__` and rewrites bare imports of
 * these specifiers to blob URLs before the plugin is imported.
 *
 * Declaring them here is what lets `tsc --noEmit` pass: without it the
 * dynamic-import fallback in `src/rpc/client.ts` fails with TS2307 and takes
 * the whole workspace typecheck down with it.
 *
 * These are shorthand (untyped) declarations on purpose. `client.ts` casts
 * to its own narrow `StageApi` view of the handful of members it uses;
 * spelling the engine's real types out here would create a second, drifting
 * copy of the host contract — the problem `src/types/plugin-api.ts` already
 * has three times over.
 */
declare module "@molvis/stage";
declare module "@molcrafts/molvis-stage";
