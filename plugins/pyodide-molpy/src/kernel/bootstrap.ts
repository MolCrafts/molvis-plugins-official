/**
 * Python the kernel runs once it is up, as **ordered stages**.
 *
 * The sources are real `.py` files under `src/py/` (see `scripts/pack-py.mjs`);
 * this module only names the stages and their order. Running them separately
 * rather than as one 130-line blob means a failure is attributed to a stage
 * instead of producing a single opaque traceback.
 */

import { MOLVIS_SETUP_PY, RPC_BRIDGE_PY } from "./generated_py";

export type BootstrapStage = {
  /** Shown in the kernel log while this stage runs. */
  readonly label: string;
  readonly source: string;
};

export const BOOTSTRAP_STAGES: readonly BootstrapStage[] = [
  { label: "RPC bridge", source: RPC_BRIDGE_PY },
  { label: "molvis setup", source: MOLVIS_SETUP_PY },
];
