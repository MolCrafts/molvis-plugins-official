import { describe, expect, it } from "@rstest/core";
import {
  createCell,
  defaultNotebook,
  loadNotebook,
  saveNotebook,
} from "../src/model/notebook";

describe("notebook model", () => {
  it("creates a default notebook with one cell", () => {
    const nb = defaultNotebook();
    expect(nb.cells.length).toBe(1);
    expect(nb.nextExec).toBe(1);
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
