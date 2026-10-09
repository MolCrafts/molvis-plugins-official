import type { Frame } from "@molcrafts/molvis-core/molrs";
import type { Molvis } from "@molcrafts/molvis-plugin";

interface EditStampMode {
  name: string;
  pendingMolecule: Frame | null;
}

function asEditStamp(mode: unknown): EditStampMode | null {
  if (!mode || typeof mode !== "object") return null;
  const candidate = mode as Partial<EditStampMode>;
  return candidate.name === "edit" && "pendingMolecule" in candidate
    ? (candidate as EditStampMode)
    : null;
}

/**
 * Arm Edit mode's stamp tool with `frame`.
 *
 * Same contract as `stageEditMolecule` from `@molcrafts/molvis-plugin`:
 * each empty-canvas click places a copy, and `frame` is freed when Edit
 * is not active. This package keeps the call local so it typechecks
 * against the SDK published on npm; switch the import when that package
 * re-exports the host function.
 */
export function stageEditMolecule(app: Molvis, frame: Frame): void {
  const editMode = asEditStamp(app.mode);
  if (!editMode) {
    frame.free();
    throw new Error("Switch to Edit mode first");
  }
  editMode.pendingMolecule = frame;
}
