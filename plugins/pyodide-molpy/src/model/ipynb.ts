/**
 * Jupyter nbformat 4 ↔ {@link NotebookState}.
 *
 * The plugin's own content *is* cells, so the notebooks it ships are `.ipynb`
 * files rather than string constants in TypeScript: the same format it
 * exports, editable in Jupyter or VS Code, and diffable as data.
 *
 * Reader and writer live together on purpose — they are one contract, and the
 * round-trip (`read(write(x)) === x`) is the property worth testing. The
 * writer previously existed alone, so an exported notebook could never be
 * opened again.
 */

import type { MimeBundle } from "../kernel/types";
import { createCell, type NotebookCell, type NotebookState } from "./cells";

/** nbformat 4 code cell (the only kind this plugin reads or writes). */
export interface IpynbCodeCell {
  cell_type: "code";
  id?: string;
  execution_count: number | null;
  metadata: Record<string, unknown>;
  outputs: IpynbOutput[];
  /** nbformat allows a string or a list of lines; both are read. */
  source: string | string[];
}

export interface IpynbOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  name?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  execution_count?: number | null;
  metadata?: Record<string, unknown>;
}

export interface IpynbDocument {
  cells: IpynbCodeCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

export const NBFORMAT = 4;
export const NBFORMAT_MINOR = 5;

const KERNELSPEC = {
  display_name: "Python (Pyodide)",
  language: "python",
  name: "python3",
} as const;

/** nbformat stores multi-line text as a list of lines keeping their `\n`. */
function toLines(text: string): string[] {
  return text.length === 0 ? [] : text.split(/(?<=\n)/);
}

function fromLines(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  return Array.isArray(value) ? value.join("") : value;
}

/** Streams and mimebundles a cell produced, in nbformat shape. */
function cellOutputs(cell: NotebookCell): IpynbOutput[] {
  const outputs: IpynbOutput[] = [];
  if (cell.output) {
    outputs.push({
      output_type: "stream",
      name: "stdout",
      text: toLines(cell.output),
    });
  }
  for (const [index, bundle] of (cell.displays ?? []).entries()) {
    outputs.push(
      index === 0
        ? {
            output_type: "execute_result",
            execution_count: cell.execCount,
            data: { ...bundle },
            metadata: {},
          }
        : { output_type: "display_data", data: { ...bundle }, metadata: {} },
    );
  }
  return outputs;
}

export interface NotebookToIpynbOptions {
  /**
   * Drop outputs and execution counts.
   *
   * Notebooks shipped with the plugin use this: committed outputs make every
   * diff noisy and would publish stale results next to fresh code.
   */
  readonly stripOutputs?: boolean;
}

export function notebookToIpynb(
  state: NotebookState,
  options: NotebookToIpynbOptions = {},
): IpynbDocument {
  const strip = options.stripOutputs === true;
  return {
    cells: state.cells.map((cell) => ({
      cell_type: "code",
      id: cell.id,
      execution_count: strip ? null : cell.execCount,
      metadata: {},
      outputs: strip ? [] : cellOutputs(cell),
      source: toLines(cell.source),
    })),
    metadata: { kernelspec: { ...KERNELSPEC }, language_info: { name: "python" } },
    nbformat: NBFORMAT,
    nbformat_minor: NBFORMAT_MINOR,
  };
}

export function notebookToIpynbText(
  state: NotebookState,
  options?: NotebookToIpynbOptions,
): string {
  return `${JSON.stringify(notebookToIpynb(state, options), null, 1)}\n`;
}

/** Thrown with a reason a human can act on — never a bare parse failure. */
export class IpynbError extends Error {}

function readOutputs(outputs: IpynbOutput[] | undefined): {
  output: string;
  displays: MimeBundle[] | undefined;
} {
  let output = "";
  const displays: MimeBundle[] = [];
  for (const item of outputs ?? []) {
    if (item.output_type === "stream") {
      output += fromLines(item.text);
    } else if (
      item.output_type === "execute_result" ||
      item.output_type === "display_data"
    ) {
      const bundle: MimeBundle = {};
      for (const [mime, value] of Object.entries(item.data ?? {})) {
        bundle[mime] = fromLines(value);
      }
      if (Object.keys(bundle).length > 0) displays.push(bundle);
    } else if (item.output_type === "error") {
      output += fromLines(item.text);
    }
  }
  return { output, displays: displays.length > 0 ? displays : undefined };
}

/**
 * Parse an nbformat 4 document (or its JSON text) into notebook state.
 *
 * Markdown and raw cells are skipped rather than rejected: this plugin has no
 * markdown renderer, and refusing to open an otherwise valid notebook because
 * of a prose cell would be worse than dropping it.
 */
export function ipynbToNotebook(input: string | unknown): NotebookState {
  let doc: unknown = input;
  if (typeof input === "string") {
    try {
      doc = JSON.parse(input);
    } catch (err) {
      throw new IpynbError(
        `not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (!doc || typeof doc !== "object") {
    throw new IpynbError("notebook must be a JSON object");
  }
  const parsed = doc as Partial<IpynbDocument>;
  if (parsed.nbformat !== undefined && parsed.nbformat !== NBFORMAT) {
    throw new IpynbError(
      `unsupported nbformat ${parsed.nbformat}; this plugin reads nbformat ${NBFORMAT}`,
    );
  }
  if (!Array.isArray(parsed.cells)) {
    throw new IpynbError("notebook has no 'cells' array");
  }

  const cells: NotebookCell[] = [];
  let highestExec = 0;
  for (const raw of parsed.cells as IpynbCodeCell[]) {
    if (!raw || typeof raw !== "object") continue;
    if (raw.cell_type !== "code") continue;
    const cell = createCell(fromLines(raw.source));
    if (typeof raw.id === "string" && raw.id.length > 0) cell.id = raw.id;
    const { output, displays } = readOutputs(raw.outputs);
    cell.output = output;
    cell.displays = displays;
    cell.execCount =
      typeof raw.execution_count === "number" ? raw.execution_count : null;
    if (cell.execCount !== null) {
      highestExec = Math.max(highestExec, cell.execCount);
      cell.status = "ok";
    }
    cells.push(cell);
  }

  if (cells.length === 0) {
    throw new IpynbError("notebook contains no code cells");
  }
  return { cells, nextExec: highestExec + 1 };
}
