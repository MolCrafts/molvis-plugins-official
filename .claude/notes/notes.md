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
  `molvis_py_sources.ts` path (superseded by `pack-local-py` +
  `local_py_sources.ts`).
- **No lockfile** — `package-lock.json` stays gitignored.
- **dist/** committed for jsDelivr; CI rebuilds + fails on stale dist; uploads
  dist artifacts for inspection.
- **Meta version scheme**: major=plugin system, minor=plugin count, patch=fixes.
  Current `0.4.0` = 4 children. `check:meta-version` + `OFFICIAL_PLUGINS`.
  Child package versions stay independent; prefer git tag = meta version.
- Host contract vendored + hashed per package; CI runs `check:contract`.
- Commit `plugins/pyodide-molpy/src/kernel/local_py_sources.ts` (monorepo
  molvis+molpy pack). CI keeps the committed file when siblings are absent.
