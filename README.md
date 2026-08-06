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

The host packages are unpublished, so `package.json` declares them as
`file:../molvis/*`. Clone MolVis as a **sibling** directory and everything
resolves with a plain install — no `npm link`:

```
work/
  molvis/                  # host checkout
  molvis-plugins-official/ # this repo
```

```bash
(cd ../molvis && npm install && npm run build:plugin && npm run build:stage)
npm install
npm run dev     # only entry for local work → http://127.0.0.1:4173/
```

`npm run dev` is `rsbuild build --watch` plus a CORS static server; pass a
port with `PORT=4174 npm run dev`, or run it inside one plugin
(`npm run dev -w @molcrafts/molvis-plugin-alchemist`).

MolVis Settings → Plugins → `http://127.0.0.1:4173/` → edit → **Reload**.

```bash
npm run build   # production dist/ (all packages)
npm run check   # manifests + typecheck + lint:py + tests + build + bundle
```

Release assets are flattened by `.github/workflows/release.yml` on a `v*`
tag; there is no local packaging step.

## Release

```bash
git tag v0.4.1
git push origin v0.4.1
```
