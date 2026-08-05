import { describe, expect, test } from "@rstest/core";
import {
  ELEMENTS,
  MAX_ELEMENT_RANK,
  getElement,
  radiusFor,
} from "./elements";
import {
  BASE_DROP_WEIGHTS,
  INITIAL_TOOLS,
  MAX_CONSECUTIVE_DROPS,
  addTool,
  advanceDangerTimer,
  calculateMergeScore,
  consumeTool,
  getSpawnDistribution,
  nextElement,
  pickRankFromDistribution,
  pickSpawnRank,
  pickToolReward,
} from "./model";
import {
  loadProgress,
  saveBestScore,
  saveDiscovered,
  saveMuted,
  type StorageAdapter,
} from "./storage";

class MemoryStorage implements StorageAdapter {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("element progression", () => {
  test("orders the eleven elements by atomic number and ends on gold", () => {
    expect(ELEMENTS).toHaveLength(11);
    expect(ELEMENTS.map((element) => element.symbol)).toEqual([
      "H",
      "C",
      "N",
      "O",
      "P",
      "S",
      "Cl",
      "K",
      "Fe",
      "Ag",
      "Au",
    ]);
    expect(ELEMENTS.map((element) => element.atomicNumber)).toEqual([
      1, 6, 7, 8, 15, 16, 17, 19, 26, 47, 79,
    ]);
    expect(getElement(1).symbol).toBe("H");
    expect(getElement(MAX_ELEMENT_RANK).symbol).toBe("Au");
  });

  test("uses strictly growing, game-scaled sizes", () => {
    const radii = ELEMENTS.map((element) => radiusFor(element.rank));
    expect(radii).toEqual([13, 19, 25, 30, 36, 43, 50, 60, 71, 82, 95]);
    expect(
      radii.every(
        (radius, index) =>
          index === 0 || radius > (radii[index - 1] ?? 0),
      ),
    ).toBe(true);
  });

  test("scales the top ranks to classic merge-game proportions", () => {
    const chamberWidth = 336;
    const diameters = ELEMENTS.map((element) => element.radius * 2);
    // The final gold atom dominates the chamber without filling it.
    const largest = diameters.at(-1) ?? 0;
    expect(largest / chamberWidth).toBeGreaterThan(0.5);
    expect(largest / chamberWidth).toBeLessThan(0.62);
    // Two silver atoms must fit side by side so the last merge stays possible.
    const secondLargest = diameters.at(-2) ?? 0;
    expect(secondLargest * 2).toBeLessThanOrEqual(chamberWidth);
    // Droppable ranks stay small enough to aim with.
    const largestDroppable = diameters[BASE_DROP_WEIGHTS.length - 1] ?? 0;
    expect(largestDroppable / chamberWidth).toBeLessThan(0.3);
  });

  test("advances every merge from Hydrogen to Gold", () => {
    let rank = 1;
    while (rank < MAX_ELEMENT_RANK) {
      const result = nextElement(rank);
      expect(result).toBe(rank + 1);
      rank = result ?? rank;
    }
    expect(nextElement(MAX_ELEMENT_RANK)).toBeNull();
  });

  test("uses the measured six-rank drop table for the whole run", () => {
    const distribution = getSpawnDistribution({ crowded: false });
    expect(distribution.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(distribution.map((item) => item.probability)).toEqual([
      0.35, 0.25, 0.2, 0.14, 0.06,
    ]);
    expect(BASE_DROP_WEIGHTS).toEqual([35, 25, 20, 14, 6]);
  });

  test("never drops anything above the six droppable ranks", () => {
    const distribution = getSpawnDistribution({ crowded: false });
    expect(distribution.every((item) => item.rank <= 5)).toBe(true);
    expect(MAX_ELEMENT_RANK).toBeGreaterThan(6);
  });

  test("halves the largest drop when the chamber is crowded", () => {
    const calm = getSpawnDistribution({ crowded: false });
    const crowded = getSpawnDistribution({ crowded: true });
    const largestCalm = calm.find((item) => item.rank === 5)?.probability ?? 0;
    const largestCrowded =
      crowded.find((item) => item.rank === 5)?.probability ?? 0;
    expect(largestCalm).toBeCloseTo(0.06);
    expect(largestCrowded).toBeCloseTo(3 / 97);
    expect(largestCrowded).toBeLessThan(largestCalm);
  });

  test("forces a different atom after three consecutive drops", () => {
    const context = { crowded: false };
    expect(pickSpawnRank(context, 1, () => 0)).not.toBe(1);
    expect(pickRankFromDistribution(
      getSpawnDistribution(context),
      () => 0.999999,
    )).toBe(5);
    expect(MAX_CONSECUTIVE_DROPS).toBe(3);
  });
});

describe("scoring, danger, and tools", () => {
  test("applies a capped 25 percent combo step", () => {
    expect(calculateMergeScore(2, 1)).toBe(40);
    expect(calculateMergeScore(2, 2)).toBe(50);
    expect(calculateMergeScore(2, 9)).toBe(80);
  });

  test("charges danger and recovers faster when the line clears", () => {
    expect(advanceDangerTimer(0, true, 0.5)).toBe(0.5);
    expect(advanceDangerTimer(1, false, 0.2)).toBe(0.5);
    expect(advanceDangerTimer(0.2, false, 1)).toBe(0);
  });

  test("starts every run with zero tools", () => {
    expect(INITIAL_TOOLS).toEqual({
      proton: 0,
      compress: 0,
      fusion: 0,
      decay: 0,
    });
  });

  test("does not consume an exhausted tool", () => {
    const stocked = addTool(INITIAL_TOOLS, "fusion", 2);
    const used = consumeTool(stocked, "fusion");
    expect(used.fusion).toBe(1);
    const exhausted = consumeTool(INITIAL_TOOLS, "fusion");
    expect(exhausted.fusion).toBe(0);
    expect(exhausted.proton).toBe(INITIAL_TOOLS.proton);
  });

  test("grants one uniformly sampled glowing-atom reward", () => {
    expect(pickToolReward(() => 0)).toBe("proton");
    expect(pickToolReward(() => 0.26)).toBe("compress");
    expect(pickToolReward(() => 0.51)).toBe("fusion");
    expect(pickToolReward(() => 0.999999)).toBe("decay");
    expect(addTool(INITIAL_TOOLS, "fusion").fusion).toBe(
      INITIAL_TOOLS.fusion + 1,
    );
  });
});

describe("progress storage", () => {
  test("round trips score, collection, and muted state", () => {
    const storage = new MemoryStorage();
    saveBestScore(storage, 4200);
    saveDiscovered(storage, [4, 2, 2, 1]);
    saveMuted(storage, true);
    expect(loadProgress(storage)).toEqual({
      bestScore: 4200,
      discovered: [1, 2, 4],
      muted: true,
    });
  });

  test("recovers safely from corrupt values", () => {
    const storage = new MemoryStorage();
    storage.setItem("bestScore", "-7");
    storage.setItem("discovered", "{bad json");
    storage.setItem("muted", "maybe");
    expect(loadProgress(storage)).toEqual({
      bestScore: 0,
      discovered: [1],
      muted: false,
    });
  });
});
