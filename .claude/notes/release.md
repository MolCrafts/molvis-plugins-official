# Release checklist

## Meta version scheme

`MAJOR.MINOR.PATCH` on root `package.json` / `molvis.plugin.json`:

| Segment | Bump | Meaning |
|---------|------|---------|
| major | Plugin system / host contract change | System generation |
| minor | Add a child under `plugins/*` | **Plugin count** (= `plugins/*` length) |
| patch | Fixes with the same plugin set | Bugfix / docs / rebuild |

Kinds live in `src/version.ts` → `OFFICIAL_PLUGINS` (must match `plugins/*`).
CI: `npm run check:meta-version`.

Child package versions stay **independent**.

## Policy

- **No `package-lock.json`** (gitignored).
- **`dist/` is required** for jsDelivr; CI fails if stale; artifacts uploaded.
- Prefer **git tag = meta version** (`v0.4.0`).

## Steps

1. Bump changed `plugins/<name>/package.json` only.
2. Bump meta: +minor if added a plugin (+ update `OFFICIAL_PLUGINS` + `index.tsx`);
   +patch for fixes; +major for system changes.
3. `npm run sync:manifests` && `npm run check:meta-version`
4. Pack pyodide local sources if monorepo py changed; commit `local_py_sources.ts`.
5. `npm run check` && `npm run test:e2e`
6. Commit all `dist/` and `plugins/*/dist/`
7. `git tag vX.Y.Z && git push origin <branch> --tags`
8. Refresh README install pin examples if the tag changed.
