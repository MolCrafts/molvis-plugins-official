import { describe, expect, test } from "@rstest/core";
import { createCell } from "../src/model/cells";
import {
  IpynbError,
  ipynbToNotebook,
  notebookToIpynb,
  notebookToIpynbText,
} from "../src/model/ipynb";
import { CAFFEINE_IPYNB, QUICKSTART_IPYNB } from "../src/notebooks/generated";

const cell = (source: string, extra: Partial<ReturnType<typeof createCell>> = {}) => ({
  ...createCell(source),
  ...extra,
});

describe("round trip", () => {
  test("read(write(state)) preserves cells, ids and exec counts", () => {
    // The writer shipped alone for a long time, so an exported notebook could
    // never be opened again. This is the invariant that keeps them a pair.
    const state = {
      cells: [
        cell("print('one')\n", { execCount: 1, output: "one\n", status: "ok" as const }),
        cell("x = 2\n"),
      ],
      nextExec: 2,
    };
    const back = ipynbToNotebook(notebookToIpynbText(state));

    expect(back.cells.map((c) => c.id)).toEqual(state.cells.map((c) => c.id));
    expect(back.cells.map((c) => c.source)).toEqual(state.cells.map((c) => c.source));
    expect(back.cells.map((c) => c.execCount)).toEqual([1, null]);
    expect(back.cells[0].output).toBe("one\n");
    expect(back.nextExec).toBe(2);
  });

  test("preserves display mimebundles", () => {
    const state = {
      cells: [
        cell("frame\n", {
          execCount: 3,
          displays: [{ "text/plain": "<Frame>" }, { "image/png": "iVBOR" }],
        }),
      ],
      nextExec: 4,
    };
    const back = ipynbToNotebook(notebookToIpynbText(state));
    expect(back.cells[0].displays).toEqual([
      { "text/plain": "<Frame>" },
      { "image/png": "iVBOR" },
    ]);
  });

  test("stripOutputs drops results but keeps the code", () => {
    const state = {
      cells: [cell("print(1)\n", { execCount: 7, output: "1\n" })],
      nextExec: 8,
    };
    const doc = notebookToIpynb(state, { stripOutputs: true });
    expect(doc.cells[0].outputs).toEqual([]);
    expect(doc.cells[0].execution_count).toBeNull();
    expect(doc.cells[0].source).toEqual(["print(1)\n"]);
  });
});

describe("reader", () => {
  test("accepts a source given as one string", () => {
    const state = ipynbToNotebook({
      cells: [{ cell_type: "code", execution_count: null, metadata: {}, outputs: [], source: "a=1\nb=2\n" }],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    });
    expect(state.cells[0].source).toBe("a=1\nb=2\n");
  });

  test("skips markdown cells rather than refusing the notebook", () => {
    const state = ipynbToNotebook({
      cells: [
        { cell_type: "markdown", metadata: {}, source: ["# title\n"] },
        { cell_type: "code", execution_count: null, metadata: {}, outputs: [], source: ["z=1\n"] },
      ],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    });
    expect(state.cells).toHaveLength(1);
    expect(state.cells[0].source).toBe("z=1\n");
  });

  test("nextExec continues past the highest execution count", () => {
    const state = ipynbToNotebook({
      cells: [
        { cell_type: "code", execution_count: 4, metadata: {}, outputs: [], source: ["a\n"] },
        { cell_type: "code", execution_count: 9, metadata: {}, outputs: [], source: ["b\n"] },
      ],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    });
    expect(state.nextExec).toBe(10);
  });

  test.each([
    ["not json at all", "{ nope"],
    ["a non-object document", JSON.stringify(42)],
    ["a document with no cells array", JSON.stringify({ nbformat: 4 })],
    ["a notebook of only markdown", JSON.stringify({ nbformat: 4, cells: [{ cell_type: "markdown", source: [] }] })],
    ["an unsupported nbformat", JSON.stringify({ nbformat: 3, cells: [] })],
  ])("rejects %s with an actionable message", (_label, text) => {
    expect(() => ipynbToNotebook(text)).toThrow(IpynbError);
  });
});

/**
 * Shipped notebooks are seed content, not someone's working copy: committed
 * outputs make every diff noisy and would publish stale results next to fresh
 * code.
 */
describe.each([
  ["quickstart", QUICKSTART_IPYNB],
  ["caffeine", CAFFEINE_IPYNB],
])("shipped notebook %s", (_name, doc) => {
  test("is nbformat 4 with code cells", () => {
    expect(doc.nbformat).toBe(4);
    expect(doc.cells.length).toBeGreaterThan(0);
  });

  test("carries no outputs and no execution counts", () => {
    for (const c of doc.cells) {
      expect(c.outputs).toEqual([]);
      expect(c.execution_count).toBeNull();
    }
  });

  test("has unique, stable cell ids", () => {
    const ids = doc.cells.map((c) => c.id);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("parses into runnable cells", () => {
    const state = ipynbToNotebook(doc);
    for (const c of state.cells) {
      expect(c.source.trim().length).toBeGreaterThan(0);
      expect(c.execCount).toBeNull();
      expect(c.output).toBe("");
    }
  });
});
