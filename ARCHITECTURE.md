# Official plugins — architecture

## Collection shape

```
plugins/                     # npm workspaces — independent packages
  pyodide-molpy/
  lammps-input-generator/
  alchemist/
  carbon-tube-builder/
src/index.tsx                # meta: activate every child once
molvis.plugin.json           # meta manifest (entry dist/plugin.js locally)
```

Meta **bundles** children at build time (source imports). Hosts install either:

| Source | What you get |
|--------|----------------|
| `MolCrafts/molvis-plugins-official@vX` | Meta (all plugins) from **GitHub Release** |
| Release asset `pyodide-molpy.zip` | Single plugin |

## OOP policy (same as template)

- **Classes**: modifiers, modes, kernel/session hosts, game engines (alchemist).
- **Functions**: `register*(api)`, pure generators, wire helpers.
- **No** god `utils.ts` / free-floating UI registry.

See [molvis-plugin-template/ARCHITECTURE.md](https://github.com/MolCrafts/molvis-plugin-template/blob/master/ARCHITECTURE.md).

### Pyodide package

```
src/kernel/          # HostKernel (JupyterLite worker) + bootstrap + RPC bridge
src/model/           # notebook / scripts / editor settings (pure data)
src/ui/              # React surfaces only
src/rpc/             # main-thread RPCRouter client
src/demo/            # demo cell sources
```

`HostKernel` is the OOP boundary for execution; UI stays functional React.

## dist/ policy

**Never commit `dist/`.** CI builds; tags run `release.yml` and upload flat
assets to GitHub Releases. Local:

```bash
npm run build
npm run serve          # http://127.0.0.1:4173/  (CORS)
```

## Versioning

- **Meta** `MAJOR.MINOR.PATCH`: major = plugin system, minor = plugin count, patch = fixes.
- **Children** keep independent versions in their `package.json` / manifests.
