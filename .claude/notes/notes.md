# Project notes

Captured decisions (newest first). Prefer superseding stale bullets over
append-only history.

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
- Host contract comes from `@molcrafts/molvis-plugin`, declared as
  `file:../molvis/plugin` (sibling checkout) until it is published. The
  vendored copies, `check:contract` and the `npm link` dance are gone.
