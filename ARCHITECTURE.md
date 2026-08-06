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

`pack-local-py.mjs` is **codegen only** (embed monorepo molvis/molpy `.py` into
TS for the worker FS) — not “copy kernel”.

## Public SDK

```ts
import { MolvisPlugin, pluginExternals } from "@molcrafts/molvis/plugin";
import { Button } from "@molcrafts/molvis/plugin/ui";
```

Scaffold: `npx molvis-plugin create`.

## OOP

- **Classes**: modifiers, modes, `HostKernel`, game engines
- **Functions**: `register*(api)`, pure generators

## Versioning

- Collection `MAJOR.MINOR.PATCH`: major = plugin system, minor = plugin count
- Children keep independent versions in their manifests
