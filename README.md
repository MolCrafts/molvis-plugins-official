# molvis-plugins-official

[![test](https://github.com/MolCrafts/molvis-plugins-official/actions/workflows/test.yml/badge.svg)](https://github.com/MolCrafts/molvis-plugins-official/actions/workflows/test.yml)

Official **collection** of [MolVis](https://github.com/MolCrafts/molvis) page
plugins. Scaffold: [molvis-plugin-template](https://github.com/MolCrafts/molvis-plugin-template)
(`npx molvis-plugin create` once that CLI is on npm).

Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Install in MolVis

| What | Source |
|------|--------|
| Collection (all plugins) | `MolCrafts/molvis-plugins-official@v0.5.0` |
| Latest release | `MolCrafts/molvis-plugins-official` |
| Local | `http://127.0.0.1:4173/` after `npm run dev` |

```jsonc
"molvis.plugins": ["MolCrafts/molvis-plugins-official@v0.5.0"]
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

Host SDK is on npm (`@molcrafts/molvis-plugin@0.2.0` and the engines). A
plain `npm install` is enough.

A sibling `../molvis` checkout is **optional**. When present, `npm run dev`
editable-installs its Python tree via `/molvis-src/` so kernel Python edits
apply on reset. Without it the kernel installs `molcrafts-molvis==0.2.0`
from PyPI.

```bash
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

## CI and release

Each workflow's first job, `<file> / context`, runs
`MolCrafts/molcrafts-ci/actions/ci-context@master`, which decides the tier,
upstream-only gating and pull-request dedup; the other jobs read its outputs.
The fast tier runs on a feature-branch push to
MolCrafts; the full tier on every push to a fork (so a branch is proven before
its pull request), on dev, master and main on MolCrafts, and on pull requests,
tags and dispatches.

| workflow | fast tier | full tier | upstream only |
|---|---|---|---|
| `lint.yml` | `lint / guards` (manifests, roster, ruff), `lint / typecheck` | same | — |
| `test.yml` | `test / context`, `test / unit` (rstest + kernel pytest) | + `test / bundle` (build + `verify:bundle`) | — |
| `release.yml` | — | — | `v*` tag: `release / assets` uploads to the GitHub Release; `workflow_dispatch` is a dry run anywhere (assets as a workflow artifact) |

A pull request inside a fork runs only the context jobs: its push already ran the full tier. Setup
is `MolCrafts/molcrafts-ci/actions/setup-{node,python}@master`.
`.pre-commit-config.yaml` runs `npm run check`, the union of all
of the above.

```bash
git tag v0.5.0
git push origin v0.5.0
```
