import type { Frame } from "@molcrafts/molvis-core/molrs";
import type { Molvis } from "@molcrafts/molvis-plugin";
import { describe, expect, it } from "@rstest/core";
import { stageEditMolecule } from "../src/edit_stamp";

function frameStub(): Frame & { freed: boolean } {
  const frame = {
    freed: false,
    free() {
      frame.freed = true;
    },
  };
  return frame as Frame & { freed: boolean };
}

describe("stageEditMolecule", () => {
  it("frees the frame when Edit mode is not active", () => {
    const frame = frameStub();
    const app = { mode: { name: "view" } } as unknown as Molvis;
    expect(() => stageEditMolecule(app, frame)).toThrow(/Edit mode/);
    expect(frame.freed).toBe(true);
  });

  it("arms Edit mode with the frame", () => {
    const frame = frameStub();
    const mode = { name: "edit", pendingMolecule: null as Frame | null };
    const app = { mode } as unknown as Molvis;
    stageEditMolecule(app, frame);
    expect(mode.pendingMolecule).toBe(frame);
    expect(frame.freed).toBe(false);
  });
});
