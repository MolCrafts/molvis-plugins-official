/**
 * Host-provided module specifier with no package behind it.
 *
 * `@molvis/stage` is the legacy spelling the host still injects on
 * `globalThis.__MOLVIS_PLUGIN_HOST_MODULES__`; nothing publishes it, so
 * `rpc/client.ts`'s dynamic-import fallback needs this declaration to
 * typecheck.
 *
 * The current spelling `@molcrafts/molvis-stage` is deliberately NOT
 * declared here: it resolves to the real package, and a shorthand ambient
 * declaration would shadow those types with `any` — which is how `Molvis`
 * started reading as a namespace instead of a type.
 */
declare module "@molvis/stage";
