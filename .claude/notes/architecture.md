# Architecture blueprint

> Run `/mol:map` to populate this blueprint. Consumed by `librarian` during
> `/mol:spec` Step 4.5.

## Packages (sketch)

| Path | Role |
|------|------|
| `/` meta | `com.molcrafts.plugins-official` — activates all children |
| `plugins/lammps-input-generator` | LAMMPS equilibration script wizard |
| `plugins/alchemist` | Canvas merge game + standalone site |
| `plugins/pyodide-molpy` | Pyodide kernel, notebook / script / console |
| `plugins/carbon-tube-builder` | Edit-panel CNT builder via MolRS |

## Layers (per plugin)

1. **Entry** — `src/index.tsx` registers commands / settings / panels / RPC
2. **Model** — pure config / notebook state (unit-tested)
3. **UI** — React surfaces using host dialogs/panels; never a second React tree
4. **Host contract** — vendored `types/contract*.ts` + `plugin-api.ts`
5. **Build** — Rsbuild/Rslib; peers externalized via `plugin-externals.ts`

## Peers (never bundle)

`react`, `react-dom`, `react/jsx-runtime`, `@molcrafts/molvis-core`,
`@molcrafts/molrs`, `@molcrafts/molplot`.
