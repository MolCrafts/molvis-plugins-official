# Project notes

Captured decisions (newest first). Prefer superseding stale bullets over
append-only history.

## 2026-08-17 — host SDK from npm 0.2.0

- Root pins `@molcrafts/molvis-plugin` / `core` / `stage` at `0.2.0` from
  npm. Sibling `file:` pins and the `npm link` dance are gone. A sibling
  molvis checkout is optional (kernel Python overlay via `molvis-src/` only).
- CI / release install from the registry; they no longer check out a molvis
  branch.
- `MICROPIP_REQUIREMENTS` pins `molcrafts-molvis==0.2.0` (on PyPI). The
  2026-08-14 "404s on PyPI / keep_going" note is superseded — install
  failures still stop the kernel, but the pin itself resolves.
- `pack:molvis-wheel` prefers a sibling `molvis/python` build, else
  `pip download` from PyPI. `pack:molvis-src` writes a manifest only when
  a sibling tree is present.
- Node rstest must `bundleDependencies` the `@molcrafts/molrs` /
  `molvis-*` chain (`rstest.molvis-node.ts`). Otherwise Node hits
  `import "./molrs_bg.wasm"` and dies. molvis itself uses browser-mode
  rstest for the same reason.

## 2026-08 — release hygiene

- Empty Alchemist template scaffold dirs (`analysis/`, `modifiers/`, `modes/`,
  `overlays/`, `shims/`, `commands/hello`, empty `settings/about`,
  `standalone/plugin`) removed — game lives in `AlchemistGame.ts` + `index.tsx`.
- Removed obsolete sources: Alchemist `index.ts` (replaced by `index.tsx`),
  LAMMPS `InitStep.tsx` (wizard is sidebar categories), Pyodide
  `host_bridge.ts` (RPC client path), and the unused `pack-molvis-py` /
  `molvis_py_sources.ts` path.
- **Pyodide python packages**: `molcrafts-molpy` / `molcrafts-molvis` are
  pinned PyPI entries in `MICROPIP_REQUIREMENTS` (`src/cdn.ts`), installed by
  micropip like numpy/molrs. The earlier vendored `wheels/` + build scripts
  are gone: the directory was never tracked (fresh clones could not build),
  the molpy wheel duplicated the PyPI release byte for byte, and CI had no
  molpy checkout to rebuild from, so a stale wheel was undetectable.
  Consequence: tag this repo only *after* the pinned molvis lands on PyPI.
- **No lockfile** — `package-lock.json` stays gitignored.
- **dist/** is gitignored; CI builds it and uploads it to the GitHub Release
  that jsDelivr serves.
- **Meta version** is plain semver. The old "minor = plugin count" rule made
  removing a plugin a version decrease; it and `check:meta-version` are gone.
  `check:official-plugins` still ties `OFFICIAL_PLUGINS` to `plugins/*`.
  Child package versions stay independent; prefer git tag = meta version.
- Host contract comes from `@molcrafts/molvis-plugin@0.2.0` on npm
  (same for core/stage). Sibling `file:` pins and the `npm link` dance
  are gone. A sibling molvis checkout is optional (kernel Python only).

## 2026-08-14 — align with molvis 0.2.0

- Every entry is a `MolvisPlugin` subclass (`export default new …()`),
  matching the template. Domain `register*(api)` functions stay.
- Peer floors: molvis-core/plugin/stage `>=0.2.0`, molrs `>=0.13.0`.
  (Host packages themselves later moved from `file:` to npm 0.2.0 —
  see 2026-08-17.)
- Carbon tube form uses SDK `Button` / `Checkbox` and host control height.
- Pyodide micropip pins: molrs 0.13.1, molpy 0.13.1, mollog 1.3.0,
  molcfg 1.5.0, **molcrafts-molvis==0.2.0**. Sibling `molvis-src/` still
  overlays that pin for local Python edits.

## 2026-08-14 — kernel bootstrap: no module named molvis

A missing molvis pin used to 404 quietly (`keep_going=True`) and then
explode as `No module named 'molvis'` in `molvis_setup.py`. `keep_going`
is gone — install failures stop the kernel. Local serve can still overlay
`/molvis-src/` (symlink to a sibling checkout) onto sys.path; the wheel
is Release fallback. The PyPI 404 itself is gone as of `molcrafts-molvis==0.2.0`.

Numpy (and pyyaml / rich) load from the **Pyodide lock**, not micropip.
`numpy==2.5.1` on PyPI is a CPython wheel; this Pyodide ships 2.4.3
emscripten. molrs 0.13.1 publishes `pyemscripten_2026_0_wasm32` and
stays on micropip.
- `tsconfig.base` no longer remaps `@molcrafts/molvis-core/molrs` to the
  raw molrs package — 0.2.0 core exports `./molrs`.
