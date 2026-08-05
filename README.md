# molvis-plugins-official

[![ci](https://github.com/MolCrafts/molvis-plugins-official/actions/workflows/ci.yml/badge.svg)](https://github.com/MolCrafts/molvis-plugins-official/actions/workflows/ci.yml)

Official **collection** of [MolVis](https://github.com/MolCrafts/molvis) page
plugins. Scaffolded from
[molvis-plugin-template](https://github.com/MolCrafts/molvis-plugin-template).

npm workspaces under `plugins/*`, plus a **meta** package at the repo root
that activates every child under one host plugin id
(`com.molcrafts.plugins-official`).

## Install in MolVis

**Settings → Plugins** (or host `molvis.plugins` / `?plugins=`). Prefer a
**pinned git tag**. Host resolves `owner/repo[@ref]` via jsDelivr from the git
tree — so **`dist/` must be committed** (CI rebuilds and fails if it is stale).

| What | Source string |
|------|----------------|
| **All official plugins (meta)** | `MolCrafts/molvis-plugins-official` (latest release) |
| **Pin meta** | `MolCrafts/molvis-plugins-official@v0.4.0` |
| **jsDelivr meta (explicit)** | `https://cdn.jsdelivr.net/gh/MolCrafts/molvis-plugins-official@v0.4.0/` |
| **LAMMPS Template only** | `https://cdn.jsdelivr.net/gh/MolCrafts/molvis-plugins-official@v0.4.0/plugins/lammps-input-generator/` |
| **Carbon Tube Builder only** | `https://cdn.jsdelivr.net/gh/MolCrafts/molvis-plugins-official@v0.4.0/plugins/carbon-tube-builder/` |
| **Alchemist only** | `https://cdn.jsdelivr.net/gh/MolCrafts/molvis-plugins-official@v0.4.0/plugins/alchemist/` |
| **Pyodide · molpy only** | `https://cdn.jsdelivr.net/gh/MolCrafts/molvis-plugins-official@v0.4.0/plugins/pyodide-molpy/` |

```jsonc
// VS Code / host inject
"molvis.plugins": ["MolCrafts/molvis-plugins-official@v0.4.0"]
```

> Do **not** install both the meta package and the same child package — you
> will get duplicate chrome (toolbar buttons / panels).

## Plugins

| Package | Host surfaces |
|---------|----------------|
| `carbon-tube-builder` | Edit inspector **Carbon tube** section |
| `alchemist` | Toolbar **Alchemist** dialog (+ standalone site) |
| `pyodide-molpy` | Python mode, Script dialog, bottom Console |
| `lammps-input-generator` | Toolbar **LAMMPS Template** wizard |

### `carbon-tube-builder`

**Carbon tube** section on the built-in Edit inspector. Choose `(n, m)`, axial
cells, bond length, vacuum, and axial periodicity; **Build & place** arms the
Edit-mode stamp tool. Geometry, seam closure, bonds, and the box come from
MolRS `CarbonTubeBuilder` on the host’s single WASM instance
(`@molcrafts/molrs` peer, ≥0.12). Requires host MolVis **≥0.2.0**.

### `alchemist`

Canvas chemistry **merge game** (toolbar **Alchemist**) — drop matching atoms
through `H → C → N → O → P → S → Cl → K → Fe → Ag → Au` (only the first six
ranks drop; higher ranks are synthesized, ending on gold). Host-owned dialog
shell (React wrapper); game itself is canvas + CSS + Web Audio. Also builds a
standalone site at `plugins/alchemist/dist/index.html`.

### `pyodide-molpy`

Browser Python via **Pyodide** (CDN) for **molpy** inside MolVis:

| Surface | Host contribution | UI |
|---------|-------------------|-----|
| **Notebook** | Python **mode** (right tools tab) | Shiki command view + lazy Monaco |
| **Script** | **dialog** + toolbar **Script** | Monaco — named `.py` library |
| **Console** | **bottom panel** | xterm.js (CDN) / `<pre>` fallback |

```python
import molvis as mv
stage = mv.Stage()          # in-process stage
mv.run("camera.py")         # Script library
```

Notebook cells share `__main__`. Pace multi-step tours with
`await asyncio.sleep` — no cell-magic step runner.

Viewer control: **molvis-python** `InProcessTransport` → page `RPCRouter`
(same JSON-RPC catalog as WebSocket):

```python
import molpy as mp
import molvis as mv

stage = mv.Stage()
aspirin = mp.io.SmilesReader("CC(=O)Oc1ccccc1C(=O)O").read()
stage.draw(aspirin)                 # → scene.draw_frame
stage.camera.fit()
stage.camera.set_pose(alpha=0.4)
```

Requires `molvis` importable inside Pyodide.

### `lammps-input-generator`

Wizard (toolbar **LAMMPS Template**) for multi-stage equilibration scripts.
Sidebar categories (not a linear “Init” wizard):

1. **System** — units, atom_style, boundary, data file, timestep  
2. **Force field** — ordered pair/bond/angle lines + presets  
3. **Neighbor** — skin, style, rebuild policy  
4. **Thermo** — output cadence / style  
5. **Minimize** — optional `min_style` + `minimize`  
6. **Equilibration** — temperature control points; **molplot** draws the T curve  
7. **Output** — dump / restart / write_data  
8. **Preview** — copy or download `in.eq`

`@molcrafts/molplot` is a **host** peer (externalized — never dual-load Vega).
RPC: `com.molcrafts.lammps-input-generator.generate` with an optional config.

## Develop

```bash
npm install
npm run test
npm run check:contract   # vendored host contract hash gate
npm run check:manifests  # molvis.plugin.json version == package.json
npm run build            # plugins/* then meta dist/
npm run check            # contract + manifests + typecheck + test + build
```

### Local debug (no publish)

Browsers cannot load `file://`. Serve over HTTP, paste the URL in
**Settings → Plugins**, then **Reload** after edits.

```bash
npm run dev                 # meta → http://127.0.0.1:4173/
npm run serve:pyodide       # :4174
npm run serve:lammps        # :4175
npm run serve:alchemist     # :4176
npm run serve:carbon-tube   # :4177
npm run preview             # cold build + static serve
```

| What | Source string |
|------|----------------|
| Meta | `http://127.0.0.1:4173/` |
| Manifest | `http://127.0.0.1:4173/molvis.plugin.json` |
| Entry | `http://127.0.0.1:4173/dist/plugin.js` |
| Pyodide alone | `http://127.0.0.1:4174/` |

`Cache-Control: no-store` on responses so Reload always fetches fresh
`plugin.js`. Pyodide re-packs sibling `molvis` / `molpy` trees when they change.

```ts
plugins: ["http://127.0.0.1:4173/"]
// ?plugins=http://127.0.0.1:4173/
```

## Versions

### Meta collection (`MAJOR.MINOR.PATCH`)

Root `package.json` / `molvis.plugin.json` describe the **collection**, not a
single child. Current: **`0.4.0`** → system gen `0`, **4 plugins**, no patch.

| Segment | Bump when… | Meaning |
|---------|------------|---------|
| **major** | Plugin **system** changes (host contract, activation model) | System generation |
| **minor** | **Add** a child under `plugins/*` | **Plugin count** (must equal `plugins/*` length) |
| **patch** | Fixes / polish with the **same** set of plugins | Bugfix / docs / rebuild |

**Kinds** (the four children): `alchemist`, `carbon-tube-builder`,
`lammps-input-generator`, `pyodide-molpy` — listed in
[`src/version.ts`](./src/version.ts) as `OFFICIAL_PLUGINS` and checked by
`npm run check:meta-version`.

### Child packages

Each `plugins/*` keeps its **own** independent version. Do not force them equal
to each other or to meta. `sync:manifests` only keeps **that** package’s
`molvis.plugin.json` equal to **its** `package.json`.

### Git tags

Prefer tagging with the meta version (`v0.4.0`) so jsDelivr pins match the
collection scheme. No lockfile is committed.

## Release

**Why `dist/`?** Install is from the git tree via jsDelivr (`gh/…@tag/…`). Without committed `dist/plugin.js` (and each `plugins/*/dist/`), hosts load nothing. CI runs `npm run build` then fails if the committed trees differ.

1. Bump **changed children** only (`plugins/<name>/package.json`).
2. Bump **meta** when the collection changes:
   - add plugin → `minor + 1` (and update `OFFICIAL_PLUGINS` + `src/index.tsx`)
   - fix only → `patch + 1`
   - plugin system / contract → `major + 1` (reset minor to current count if needed)
3. `npm run sync:manifests` then `npm run check:meta-version`.
4. Refresh Pyodide monorepo pack when siblings changed:
   `npm run pack:local-py -w @molcrafts/molvis-plugin-pyodide-molpy` and commit
   `plugins/pyodide-molpy/src/kernel/local_py_sources.ts`.
5. `npm run check` — contract, manifests, meta version, typecheck, tests, build.
6. `npm run test:e2e` — Alchemist Playwright (CI also runs this).
7. Commit **`dist/`** and **`plugins/*/dist/`** (including Alchemist hashed
   static assets and bundler `*.LICENSE.txt`).
8. Tag with the meta version:

```bash
git tag v0.4.0 && git push origin master --tags
```

Update install pin examples in this README when the tag changes.

## Toolchain

| Piece | Baseline |
|-------|----------|
| React / ReactDOM | **^19.2.8** (peer; never bundle) |
| JSX | **automatic** via `@rsbuild/plugin-react` |
| TypeScript | **^7** · `target`/`lib` **ES2024** · `jsx: "react-jsx"` |
| UI | Function components + hooks only |
| Discovery | Prefer **command palette** — do not inject host chrome casually |
| Host contract | Vendored under `src/types/contract*.ts` (+ per-plugin copy); `check:contract` |

Shared options: [`rsbuild.plugin-shared.ts`](./rsbuild.plugin-shared.ts),
externals: [`plugin-externals.ts`](./plugin-externals.ts).

## Peers (externalize — never bundle)

| Package | Why |
|---------|-----|
| `react` / `react-dom` / `react/jsx-runtime` | Shared React 19 tree |
| `@molcrafts/molvis-core` | Engine / stage |
| `@molcrafts/molrs` **≥0.12** | Shared WASM / Frame |
| `@molcrafts/molplot` | Shared Vega charts |

## License

BSD-3-Clause — see [LICENSE](./LICENSE).
