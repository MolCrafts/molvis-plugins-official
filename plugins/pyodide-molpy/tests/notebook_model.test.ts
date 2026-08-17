import { describe, expect, it } from "@rstest/core";
import { saveLibrary, storedScriptCount } from "../src/model/scripts";
import {
  defaultNotebook,
  demoNotebook,
  loadNotebook,
  resetToDemoNotebook,
  saveNotebook,
  storedCellCount,
} from "../src/model/notebook";
import { createCell } from "../src/model/cells";

describe("notebook model", () => {
  it("creates a default notebook with one quick-start cell", () => {
    const nb = defaultNotebook();
    expect(nb.cells.length).toBe(1);
    expect(nb.cells[0].source).toContain("mv.run");
    expect(nb.nextExec).toBe(1);
  });

  it("demo notebook cells are runnable and only the tour cell is a magic", () => {
    // This used to be ~35 `toContain` assertions on the literal Python text,
    // including ten `not.toContain` on strings ("draw_atom", "asyncio",
    // "while True") that appear in no source file. That is a change detector
    // on a data literal: it can only fail when someone edits the demo, which
    // is the intended act. What actually has to hold is structural.
    const nb = demoNotebook();
    expect(nb.cells.length).toBeGreaterThan(0);

    const magics = nb.cells.filter((c) => c.source.includes("%%mv."));
    expect(magics).toHaveLength(1);
    expect(magics[0].source).toMatch(/^%%mv\.demo\b/m);

    for (const cell of nb.cells) {
      expect(cell.source.trim().length).toBeGreaterThan(0);
      // A magic header is stripped before exec; every other line must be
      // ordinary Python, so no cell may open with a bare `%`.
      const body = cell.source.replace(/^%%mv\.[^\n]*\n?/, "");
      expect(body).not.toMatch(/^\s*%/);
    }
  });

  it("resetToDemoNotebook fills three demo cells", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    saveNotebook(storage, {
      cells: [createCell("junk")],
      nextExec: 9,
    });
    const next = resetToDemoNotebook(storage);
    expect(next.cells.length).toBe(3);
    expect(loadNotebook(storage).cells[0].source).toContain("SmilesReader");
    expect(loadNotebook(storage).cells[0].source).toContain(
      "stage.draw_frame(frame)",
    );
    expect(loadNotebook(storage).cells[0].source).toContain("stage.commit()");
    expect(loadNotebook(storage).cells[2].source).toContain("%%mv.demo");
  });

  it("round-trips through storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    const nb = defaultNotebook();
    nb.cells.push(createCell("print(2)"));
    saveNotebook(storage, nb);
    const loaded = loadNotebook(storage);
    expect(loaded.cells.length).toBe(2);
    expect(loaded.cells[1].source).toBe("print(2)");
  });
});

describe("stored counts", () => {
  const store = () => {
    const map = new Map<string, string>();
    return {
      map,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
  };

  it("reports 0 cells when nothing was ever saved", () => {
    expect(storedCellCount(store())).toBe(0);
    expect(storedCellCount(null)).toBe(0);
  });

  it("counts persisted cells", () => {
    const s = store();
    saveNotebook(s, { cells: [createCell("a"), createCell("b")], nextExec: 1 });
    expect(storedCellCount(s)).toBe(2);
  });

  it("counts persisted scripts from the files record", () => {
    const s = store();
    expect(storedScriptCount(s)).toBe(0);
    saveLibrary(s, {
      version: 1,
      active: "a.py",
      files: { "a.py": { name: "a.py", source: "", updatedAt: 0 } },
    });
    expect(storedScriptCount(s)).toBe(1);
  });

  it("survives corrupt storage", () => {
    const s = store();
    s.setItem("notebook.v1", "{not json");
    s.setItem("scripts.v1", "{not json");
    expect(storedCellCount(s)).toBe(0);
    expect(storedScriptCount(s)).toBe(0);
  });
});
