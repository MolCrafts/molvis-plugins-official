# molvis-plugins-official

[![ci](https://github.com/MolCrafts/molvis-plugins-official/actions/workflows/ci.yml/badge.svg)](https://github.com/MolCrafts/molvis-plugins-official/actions/workflows/ci.yml)

Official **collection** of [MolVis](https://github.com/MolCrafts/molvis) page
plugins. Scaffold: [molvis-plugin](https://github.com/MolCrafts/molvis-plugin-template)
(`npx molvis-plugin create`).

Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Install in MolVis

| What | Source |
|------|--------|
| Collection (all plugins) | `MolCrafts/molvis-plugins-official@v0.4.0` |
| Latest release | `MolCrafts/molvis-plugins-official` |
| Local | `http://127.0.0.1:4173/` after `npm run dev` |

```jsonc
"molvis.plugins": ["MolCrafts/molvis-plugins-official@v0.4.0"]
```

Do **not** install both the collection and the same child package.

`dist/` is gitignored. Tags `v*` → GitHub Release assets (flat `plugin.js` +
kernel workers/wheels when present).

## Plugins

| Package | Surfaces |
|---------|----------|
| `carbon-tube-builder` | Edit → Carbon tube |
| `alchemist` | Toolbar Alchemist |
| `pyodide-molpy` | Python mode (JupyterLite pyodide-kernel), Script, Console |
| `lammps-input-generator` | Toolbar LAMMPS Template |

## Develop

```bash
npm install
npm run dev     # only entry for local work → http://127.0.0.1:4173/
```

MolVis Settings → Plugins → `http://127.0.0.1:4173/` → edit → **Reload**.

```bash
npm run build            # production dist/ (all packages)
npm run prepare:release  # flatten into release-assets/ for tags
```

## Release

```bash
git tag v0.4.1
git push origin v0.4.1
```
