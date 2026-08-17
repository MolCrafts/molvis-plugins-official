# Release checklist

## Meta version scheme

`MAJOR.MINOR.PATCH` on root `package.json` / `molvis.plugin.json`:

| Segment | Bump | Meaning |
|---------|------|---------|
| major | Plugin system / host contract change | System generation |
| minor | Collection-level feature | Plain semver |
| patch | Fixes with the same plugin set | Bugfix / docs / rebuild |

Kinds live in `src/version.ts` → `OFFICIAL_PLUGINS` (must match `plugins/*`).
CI: `npm run check:official-plugins`.

Child package versions stay **independent**.

## Policy

- **No `package-lock.json`** (gitignored).
- **`dist/` is required** for jsDelivr; CI fails if stale; artifacts uploaded.
- Prefer **git tag = meta version** (`v0.5.0`).

## Steps

1. Bump changed `plugins/<name>/package.json` **and** its `molvis.plugin.json`
   (`check:manifests` asserts they match).
2. Bump meta for collection-level changes; plain semver, no count rule.
   Adding a plugin also means updating `OFFICIAL_PLUGINS` + `src/index.tsx`
   (`check:official-plugins` asserts the roster matches `plugins/*`).
3. `npm run check`
4. `git tag vX.Y.Z && git push origin <branch> --tags` — the workflow builds,
   flattens and uploads the assets. `dist/` is **not** committed.
5. Refresh README install pin examples if the tag changed.

**Ordering:** `MICROPIP_REQUIREMENTS` pins `molcrafts-molvis==X`, so that
version must be on PyPI **before** this repo is tagged.
