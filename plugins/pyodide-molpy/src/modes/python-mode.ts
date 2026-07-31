import type { Molvis } from "@molcrafts/molvis-core";

/**
 * View-like plugin mode: no special picking, canvas navigation stays usable.
 * Host ModeManager only requires start/finish + name.
 */
export function createPythonMode(modeId: string) {
  return (_app: Molvis) => {
    return {
      name: modeId,
      start() {
        /* canvas orbit remains default host behavior */
      },
      finish() {
        /* no-op */
      },
    };
  };
}
