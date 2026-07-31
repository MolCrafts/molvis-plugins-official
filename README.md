# molvis-plugins-official

[![ci](https://github.com/MolCrafts/molvis-plugins-official/actions/workflows/ci.yml/badge.svg)](https://github.com/MolCrafts/molvis-plugins-official/actions/workflows/ci.yml)

Official **collection** of [MolVis](https://github.com/MolCrafts/molvis) page
plugins. Scaffolded from
[molvis-plugin-template](https://github.com/MolCrafts/molvis-plugin-template).

| Install | Source |
|---------|--------|
| **All official plugins (meta)** | `MolCrafts/molvis-plugins-official` (no tag → **latest release**) |
| **Pin a version** | `MolCrafts/molvis-plugins-official@v0.1.0` |
| **LAMMPS input generator only** | CDN subdir URL to `plugins/lammps-input-generator/` |
| **Alchemist only** | CDN subdir URL to `plugins/alchemist/` |
| **Pyodide · molpy only** | CDN subdir URL to `plugins/pyodide-molpy/` |

> Do **not** install both the meta package and the same child package — you
> will get duplicate toolbar buttons.

## Plugins

### `alchemist`

Canvas chemistry **merge game** (toolbar **Alchemist**) — drop matching atoms
through the `H → C → N → O → P → S → K` chain. Opens in a full-screen modal,
and the same code also builds a **static site** (`plugins/alchemist/dist/index.html`)
for standalone deployment. No React: canvas + CSS + Web Audio.

### `pyodide-molpy`

Browser Python via **Pyodide** (CDN) for exploring **molpy** inside MolVis:

| Surface | Host contribution | UI |
|---------|-------------------|-----|
| **Notebook** | Python **mode** (right tools tab) | Multi-cell **textarea** (no Monaco) |
| **Script** | **dialog** + toolbar **Script** | **Monaco only** — named `.py` library |
| **Console** | **bottom panel** | xterm.js (CDN) / `<pre>` fallback |

Call library scripts from notebook or code:

```python
import molvis as mv
mv.run("camera.py")       # named script from the Script library
stage.run("camera.py")    # same, bound to stage
```

Requires a molvis page host with `api.dialogs`, `api.panels`, and dynamic mode
tabs. Browser `stage` is a stub until InProcess transport lands; CPython
`mv.Stage` drives the real viewer.

### `lammps-input-generator`

Multi-step wizard (toolbar **LAMMPS Input**) that generates a LAMMPS input
script with a multi-stage temperature schedule:

1. **Init** — units, atom_style, boundary, data file, **force-field placeholders**
   (`pair_style` / `pair_coeff` + commented bond/angle/… stubs)
2. **Minimize** — optional `min_style` + `minimize`
3. **Equilibration** — add **调温点** (step, T); each segment gets ensemble /
   thermostat / optional P; **molplot** draws the T curve with tween + playhead
   animation
4. **Output** — dump / restart / write_data
5. **Preview** — copy or download `in.eq`

`@molcrafts/molplot` is a **host** dependency (MolVis already bundles it) and is
externalized — never dual-load Vega inside the plugin.

## Develop

```bash
npm install
npm run test
npm run build   # builds plugins/* then meta dist/
```

Commit **`dist/`** (and `plugins/*/dist/`) before tagging — jsDelivr serves the
git tree.

```bash
git tag v0.1.0 && git push origin main --tags
```

## Peers (externalize — never bundle)

| Package | Why |
|---------|-----|
| `react` / `react-dom` / `react/jsx-runtime` | Shared React tree |
| `@molcrafts/molvis-core` / stage aliases | Engine |
| `@molcrafts/molrs` | Shared WASM |
| `@molcrafts/molplot` | Shared Vega charts |

## License

BSD-3-Clause — see [LICENSE](./LICENSE).
