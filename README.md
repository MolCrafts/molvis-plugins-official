# molvis-plugins-official

[![ci](https://github.com/MolCrafts/molvis-plugins-official/actions/workflows/ci.yml/badge.svg)](https://github.com/MolCrafts/molvis-plugins-official/actions/workflows/ci.yml)

Official **collection** of [MolVis](https://github.com/MolCrafts/molvis) page
plugins. Scaffolded from
[molvis-plugin-template](https://github.com/MolCrafts/molvis-plugin-template).

Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Install in MolVis

**Settings → Plugins** (or host `molvis.plugins` / `?plugins=`). **Pin a release
tag** — packages are **GitHub Release assets** (not git tree / jsDelivr `gh/`).

| What | Source string |
|------|----------------|
| **All official plugins (meta)** | `MolCrafts/molvis-plugins-official@v0.4.0` |
| **Latest release** | `MolCrafts/molvis-plugins-official` |
| **Local debug** | `http://127.0.0.1:4173/dist/plugin.js` after `npm run serve` |

```jsonc
"molvis.plugins": ["MolCrafts/molvis-plugins-official@v0.4.0"]
```

> Do **not** install both the meta package and the same child package — duplicate chrome.

`dist/` is **gitignored**. CI builds; tagging `v*` uploads flat assets via
`.github/workflows/release.yml`.

## Plugins

| Package | Host surfaces |
|---------|----------------|
| `carbon-tube-builder` | Edit inspector **Carbon tube** section |
| `alchemist` | Toolbar **Alchemist** dialog (+ standalone site) |
| `pyodide-molpy` | Python mode (JupyterLite **pyodide-kernel** worker), Script dialog, Console |
| `lammps-input-generator` | Toolbar **LAMMPS Template** wizard |

### `pyodide-molpy`

Browser Python via **@jupyterlite/pyodide-kernel** (Worker + IPython streams).
Molvis Stage talks to the page `RPCRouter` over a postMessage bridge.

```python
import molpy as mp
import molvis as mv

stage = mv.Stage()
frame = mp.io.SmilesReader("CN1C=NC2=C1C(=O)N(C(=O)N2C)C").read()
stage.draw_frame(frame)
stage.commit()
stage.camera.fit()
print("ok")  # → cell output via kernel IOPub
```

True KeyboardInterrupt needs **COOP/COEP** on the host page
(`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`).

## Develop

```bash
npm install
npm run test
npm run build
npm run prepare:release   # → release-assets/ (not committed)
npm run serve             # CORS HTTP for local install
```

## Release

```bash
git tag v0.4.1
git push origin v0.4.1    # triggers release.yml → GitHub Release assets
```
