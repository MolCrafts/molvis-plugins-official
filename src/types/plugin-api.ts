/**
 * Plugin contract — re-export of the vendored `contract.ts`.
 *
 * The contract itself is generated: it is a byte-identical copy of the
 * molvis monorepo's `page/src/plugins/contract.ts`, refreshed with
 * `node scripts/sync-plugin-contract.mjs` from that repo and verified in CI.
 *
 * This module exists so existing `./types/plugin-api` imports keep working.
 * Add nothing here — a local addition is exactly how the three previous
 * hand-maintained copies drifted apart.
 */
export type * from "./contract";
