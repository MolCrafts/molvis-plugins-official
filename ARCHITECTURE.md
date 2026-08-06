# Official plugins — architecture

## Layout

```
plugins/                     # independent packages (npm workspaces)
  pyodide-molpy/             # HostKernel + notebook UI
  lammps-input-generator/
  alchemist/
  carbon-tube-builder/
src/index.tsx                # collection: activate every child once
molvis.plugin.json
rsbuild.plugin-shared.ts     # one build recipe for all packages
```

**Collection** (`src/`) source-imports children and builds one `dist/plugin.js`.
Hosts install either the collection or a single child from GitHub Releases.

## Build (only two user commands)

| Command | Meaning |
|---------|---------|
| `npm run dev` | watch + CORS HTTP → `http://127.0.0.1:4173/` |
| `npm run build` | production `dist/` for children + collection |

No `build:meta`, no post-build shell copies.

### Kernel runtime assets (pyodide)

Owned by **rsbuild**, flag `kernelRuntime: true` in:

- `plugins/pyodide-molpy/rsbuild.config.ts`
- root `rsbuild.config.ts` (collection embeds HostKernel)

That sets `output.copy` from `@jupyterlite/pyodide-kernel` → flat next to `plugin.js`:

```
dist/
  plugin.js
  comlink.worker.js | coincident.worker.js
  all.json
  piplite-*.whl …
```

Runtime resolution: `runtime_assets.ts` (base URL from host
`__MOLVIS_PLUGIN_ENTRY__`, cross-origin workers via blob). Upstream
`_pypi.js` is stubbed so binary wheels are not treated as JS modules.

`molpy` and `molvis` are pinned PyPI packages in `MICROPIP_REQUIREMENTS`
(`src/cdn.ts`), installed by micropip alongside numpy/molrs/mollog/molcfg.
They used to ship as wheels committed under `plugins/pyodide-molpy/wheels/`
and built by a script from sibling checkouts — but that directory was never
tracked (a fresh clone could not build), the molpy wheel duplicated the PyPI
release exactly, and CI had no molpy checkout to rebuild from, so a stale
wheel could not be detected. Note the ordering consequence: the plugin
release must follow the `molcrafts-molvis` PyPI release it pins.

## Public SDK

```ts
import { MolvisPlugin, pluginExternals } from "@molcrafts/molvis/plugin";
import { Button } from "@molcrafts/molvis/plugin/ui";
```

Scaffold: `npx molvis-plugin create`.

`pluginExternals` is the whole externals list — never retype it, and never
add a package to a local externals map instead. It includes
`@molcrafts/molvis-plugin` itself: the SDK is a host module, so a plugin that
bundles it ships a private copy of the shadcn primitives plus their Radix /
`clsx` / `tailwind-merge` tree. That is measurable — a plugin that imported
`@radix-ui/react-select` directly instead of the SDK's `Select` built to
160 KB, against 7.4 KB for one that did not. Two such plugins installed
separately also give the host two Radix trees, which `resolve.dedupe` cannot
prevent because it only dedupes *within* a bundle.

## Testing

Unit only, `rstest` in a node environment, one lane:

```bash
npm test        # every plugin's tests + the python bridge tests
```

There is no e2e. The Alchemist Playwright suite was removed: it gated both
`ci.yml` and `release.yml` while being **red** — its fake `PluginAPI` omitted
`dialogs`, which `src/index.tsx` calls during `activate`, so a tag push could
not publish. Several of its assertions also targeted selectors present in zero
source files, so they could not fail. What it meant to prove is covered by
`src/index.test.ts` through `fakePluginAPI`, which is built from the real
`PluginAPI` type and therefore turns a new domain into a compile error rather
than a silent pass.

Host-shell behaviour that a unit test cannot reach is a signal that the seam is
wrong, not a reason to add a browser driver.

## OOP

- **Classes**: modifiers, modes, `HostKernel`, game engines
- **Functions**: `register*(api)`, pure generators

## Versioning

- Collection `MAJOR.MINOR.PATCH`: major = plugin system, minor = plugin count
- Children keep independent versions in their manifests
