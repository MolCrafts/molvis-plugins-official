import { describe, expect, it } from "@rstest/core";
import { saveLibrary, storedScriptCount } from "../src/model/scripts";
import {
  createCell,
  defaultNotebook,
  demoNotebook,
  loadNotebook,
  notebookToIpynb,
  resetToDemoNotebook,
  saveNotebook,
  storedCellCount,
} from "../src/model/notebook";

describe("notebook model", () => {
  it("migrates the old demo rate option to seconds per step", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    };
    saveNotebook(storage, { cells: [createCell("%%mv.demo rate=2\nprint(1)")], nextExec: 1 });
    expect(loadNotebook(storage).cells[0].source).toContain("delay=0.5");
  });

  it("exports a valid nbformat 4 notebook", () => {
    const nb = { cells: [createCell("print('edited')\n")], nextExec: 1 };
    const exported = JSON.parse(notebookToIpynb(nb));
    expect(exported.nbformat).toBe(4);
    expect(exported.cells[0]).toMatchObject({
      cell_type: "code",
      source: ["print('edited')\n"],
      outputs: [],
    });
    expect(exported.metadata.kernelspec.name).toBe("python3");
  });

  it("creates a default notebook with one quick-start cell", () => {
    const nb = defaultNotebook();
    expect(nb.cells.length).toBe(1);
    expect(nb.cells[0].source).toContain("mv.run");
    expect(nb.nextExec).toBe(1);
  });

  it("demo notebook: caffeine draw_frame+commit → orbit → style then theme tours", () => {
    const nb = demoNotebook();
    expect(nb.cells.length).toBe(3);
    const [build, orbit, styles] = nb.cells.map((c) => c.source);

    expect(build).not.toContain("%%mv.demo");
    expect(build).toContain("SmilesReader");
    expect(build).toContain("CN1C=NC2=C1C(=O)N(C(=O)N2C)C");
    expect(build).toContain(".read()");
    expect(build).toContain("stage.draw_frame(frame)");
    expect(build).toContain("stage.commit()");
    expect(build).toContain("stage.camera.fit()");
    expect(build).not.toContain("stage.draw(frame)");
    expect(build).not.toContain("draw_atom");
    expect(build).not.toContain("draw_bond");
    expect(build).not.toContain("asyncio");

    expect(orbit).not.toContain("%%mv.demo");
    expect(orbit).toContain("numpy");
    expect(orbit).toContain("camera.pose");
    expect(orbit).toContain("camera.track");
    expect(orbit).toContain("duration=np.inf");
    expect(orbit).not.toContain("while True");
    expect(orbit).not.toContain("draw_atom");
    expect(orbit).not.toContain("asyncio");

    expect(styles).toContain("%%mv.demo");
    expect(styles).toMatch(/delay=\d+(\.\d+)?/);
    expect(styles).toContain("stage.STYLE");
    expect(styles).toContain("stage.THEME");
    expect(styles).toContain("stage.set_style(style)");
    expect(styles).toContain("stage.set_theme(theme)");
    // set_style lives in its own loop — not nested inside THEME.
    expect(styles).toMatch(
      /for style in stage\.STYLE:[\s\S]*?stage\.set_style\(style\)[\s\S]*?for theme in stage\.THEME:[\s\S]*?stage\.set_theme\(theme\)/,
    );
    expect(styles).not.toContain("set_style(style, theme)");
    expect(styles).not.toContain("draw_atom");
    expect(styles).not.toContain("asyncio");
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
