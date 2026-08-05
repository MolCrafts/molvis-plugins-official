/**
 * Module specifiers the host provides at runtime, so a plugin bundle must not
 * contain its own copy.
 *
 * This list must match `pluginHostModules` in the host's
 * `page/src/plugins/host_shared.ts` **exactly**, in both directions:
 *
 * - externalized but not injected → the bare specifier survives the loader's
 *   rewrite and the browser throws `Failed to resolve module specifier`;
 * - injected but not externalized → the plugin quietly bundles a second copy,
 *   which for molrs means a second WASM instance and two disjoint element
 *   registries.
 *
 * Both mistakes were live here: `@molcrafts/molrs` and `@molcrafts/molvis-core`
 * were externalized with nothing to resolve to (which is why the template's own
 * example modifier could not load), while `@molcrafts/molvis-core/molrs` and
 * `/elements` were injected but bundled anyway.
 *
 * Subpath exports count separately — rspack does not treat them as covered by
 * the package root.
 *
 * Kept dependency-free so both rsbuild and rslib configs can import it.
 */
export const pluginExternals = {
  react: "react",
  "react-dom": "react-dom",
  "react-dom/client": "react-dom/client",
  "react/jsx-runtime": "react/jsx-runtime",
  "react/jsx-dev-runtime": "react/jsx-dev-runtime",
  "@molcrafts/molvis-core/molrs": "@molcrafts/molvis-core/molrs",
  "@molcrafts/molvis-core/keys": "@molcrafts/molvis-core/keys",
  "@molcrafts/molvis-core/elements": "@molcrafts/molvis-core/elements",
  "@molcrafts/molplot": "@molcrafts/molplot",
  "@molvis/stage": "@molvis/stage",
  "@molcrafts/molvis-stage": "@molcrafts/molvis-stage",
} as const;
