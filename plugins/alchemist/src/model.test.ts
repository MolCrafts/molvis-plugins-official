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
  test("orders the selected elements by atomic number", () => {
    expect(ELEMENTS).toHaveLength(7);
    expect(ELEMENTS.map((element) => element.symbol)).toEqual([
      "H",
      "C",
      "N",
      "O",
      "P",
      "S",
      "K",
    ]);
    expect(ELEMENTS.map((element) => element.atomicNumber)).toEqual([
      1, 6, 7, 8, 15, 16, 19,
    ]);
    expect(getElement(1).symbol).toBe("H");
    expect(getElement(7).symbol).toBe("K");
  });

  test("uses visibly different, game-scaled sizes", () => {
    const radii = ELEMENTS.map((element) => radiusFor(element.rank));
    expect(radii).toEqual([20, 29, 40, 53, 68, 85, 105]);
    expect(
      radii.every(
        (radius, index) =>
          index === 0 || radius > (radii[index - 1] ?? 0),
      ),
    ).toBe(true);
  });

  test("widens diameter steps so every rank reads clearly", () => {
    const diameters = ELEMENTS.map((element) => element.radius * 2);
    const steps = diameters
      .slice(1)
      .map((diameter, index) => diameter - (diameters[index] ?? 0));
    expect(
      steps.every(
        (step, index) => index === 0 || step > (steps[index - 1] ?? 0),
      ),
    ).toBe(true);
  });

  test("keeps the second-largest atom above half the chamber width", () => {
    const diameters = ELEMENTS.map((element) => element.radius * 2);
    const secondLargest = diameters.at(-2) ?? 0;
    const halfChamberWidth = 336 / 2;
    expect(secondLargest).toBeGreaterThan(halfChamberWidth);
  });

  test("advances every merge from Hydrogen to Potassium", () => {
    let rank = 1;
    while (rank < MAX_ELEMENT_RANK) {
      const result = nextElement(rank);
      expect(result).toBe(rank + 1);
      rank = result ?? rank;
    }
    expect(nextElement(MAX_ELEMENT_RANK)).toBeNull();
  });

  test("uses the fixed base table from the very first drop", () => {
    const distribution = getSpawnDistribution({
      peakRank: 1,
      unlockedCount: 1,
      crowded: false,
    });
    expect(distribution.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(distribution.map((item) => item.probability)).toEqual([
      0.45, 0.28, 0.16, 0.08, 0.03,
    ]);
    expect(BASE_DROP_WEIGHTS).toEqual([45, 28, 16, 8, 3]);
  });

  test("keeps the base table varied even for fully unlocked players", () => {
    const distribution = getSpawnDistribution({
      peakRank: 1,
      unlockedCount: 7,
      crowded: false,
    });
    expect(distribution.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(distribution[0]?.probability).toBeCloseTo(0.45);
    expect(distribution.at(-1)?.rank).toBe(5);
  });

  test("never offers the run's peak rank once the top phase starts", () => {
    const distribution = getSpawnDistribution({
      peakRank: 6,
      unlockedCount: 1,
      crowded: false,
    });
    expect(distribution.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(
      distribution.every((item) => item.rank < 6),
    ).toBe(true);
  });

  test("shifts the window up every three unlocked elements", () => {
    const shifted = getSpawnDistribution({
      peakRank: 7,
      unlockedCount: 4,
      crowded: false,
    });
    expect(shifted.map((item) => item.rank)).toEqual([2, 3, 4, 5, 6]);
    expect(shifted[0]?.probability).toBeCloseTo(0.45);
  });

  test("keeps ~10% low-rank drops at the final stage", () => {
    const final = getSpawnDistribution({
      peakRank: 7,
      unlockedCount: 7,
      crowded: false,
    });
    const lowRank = final
      .filter((item) => item.rank <= 2)
      .reduce((sum, item) => sum + item.probability, 0);
    expect(lowRank).toBeGreaterThan(0.04);
    expect(lowRank).toBeLessThan(0.12);
    expect(final.at(-1)?.rank).toBe(6);
  });

  test("halves the largest drop when the chamber is crowded", () => {
    const calm = getSpawnDistribution({
      peakRank: 5,
      unlockedCount: 1,
      crowded: false,
    });
    const crowded = getSpawnDistribution({
      peakRank: 5,
      unlockedCount: 1,
      crowded: true,
    });
    const largestCalm = calm.find((item) => item.rank === 5)?.probability ?? 0;
    const largestCrowded =
      crowded.find((item) => item.rank === 5)?.probability ?? 0;
    expect(largestCrowded).toBeLessThan(largestCalm);
  });

  test("forces a different atom after three consecutive drops", () => {
    const context = { peakRank: 6, unlockedCount: 1, crowded: false };
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

  test("does not consume an exhausted tool", () => {
    const used = consumeTool(INITIAL_TOOLS, "fusion");
    expect(used.fusion).toBe(1);
    const exhausted = consumeTool({ ...used, fusion: 0 }, "fusion");
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
