import { MAX_ELEMENT_RANK } from "./elements";

export type GamePhase = "ready" | "playing" | "paused" | "won" | "lost";
export type ToolKind = "proton" | "compress" | "fusion" | "decay";

export const TOOL_KINDS: readonly ToolKind[] = [
  "proton",
  "compress",
  "fusion",
  "decay",
];

export interface ToolInventory {
  proton: number;
  compress: number;
  fusion: number;
  decay: number;
}

export const INITIAL_TOOLS: Readonly<ToolInventory> = {
  proton: 3,
  compress: 3,
  fusion: 2,
  decay: 2,
};

export interface BoltzmannProbability {
  readonly rank: number;
  readonly probability: number;
}

export function nextElement(rank: number): number | null {
  return rank >= MAX_ELEMENT_RANK ? null : rank + 1;
}

/**
 * Spawn pacing is a fixed five-rank table tuned for synthesis rhythm rather
 * than natural abundance: atomic number only decides the merge order. The
 * table shifts up as the player unlocks elements, never offers the run's peak
 * directly, keeps ~10% low-rank drops at the final stage, and pulls the
 * largest drop back when the chamber gets crowded.
 */
export const BASE_DROP_WEIGHTS: readonly number[] = [45, 28, 16, 8, 3];
export const MAX_CONSECUTIVE_DROPS = 3;
export const SPAWN_WINDOW_STRIDE = 3;

export interface SpawnContext {
  /** Highest element synthesized so far this run. */
  peakRank: number;
  /** Number of elements unlocked in the collection (always >= 1). */
  unlockedCount: number;
  /** True when the chamber stack has passed 75% of its height. */
  crowded: boolean;
}

export function getSpawnDistribution(
  context: SpawnContext,
): BoltzmannProbability[] {
  const shift = Math.floor(
    Math.max(0, context.unlockedCount - 1) / SPAWN_WINDOW_STRIDE,
  );

  // Phase 1 (peak below S): fixed base table so early drops stay varied —
  // the pool never collapses to H-only. Phase 2 (peak S and up): the window
  // moves up with unlocks and never offers the current peak directly.
  let windowMin: number;
  let windowMax: number;
  if (context.peakRank >= MAX_ELEMENT_RANK - 1) {
    windowMin = 1 + shift;
    windowMax = Math.max(
      windowMin,
      Math.min(windowMin + BASE_DROP_WEIGHTS.length - 1, context.peakRank - 1),
    );
  } else {
    windowMin = 1;
    windowMax = BASE_DROP_WEIGHTS.length;
  }

  const weights = new Map<number, number>();
  const addWeight = (rank: number, weight: number): void => {
    if (rank < windowMin || rank > windowMax) return;
    weights.set(rank, (weights.get(rank) ?? 0) + weight);
  };

  for (let index = 0; index < BASE_DROP_WEIGHTS.length; index += 1) {
    addWeight(windowMin + index, BASE_DROP_WEIGHTS[index]);
  }

  // Final stage: keep ~10% low-rank drops to create space-management pressure.
  if (windowMin >= 3) {
    for (let index = 0; index < BASE_DROP_WEIGHTS.length; index += 1) {
      const rank = 1 + index;
      if (rank > windowMax) continue;
      weights.set(rank, (weights.get(rank) ?? 0) + BASE_DROP_WEIGHTS[index] * 0.1);
    }
  }

  // Crowded chamber: halve the probability of the largest drop in the pool.
  if (context.crowded) {
    const largestRank = Math.max(...weights.keys());
    const largestWeight = weights.get(largestRank) ?? 0;
    weights.set(largestRank, largestWeight / 2);
  }

  const totalWeight = [...weights.values()].reduce(
    (sum, weight) => sum + weight,
    0,
  );
  return [...weights.entries()]
    .map(([rank, weight]) => ({ rank, probability: weight / totalWeight }))
    .sort((left, right) => left.rank - right.rank);
}

export function pickRankFromDistribution(
  distribution: readonly BoltzmannProbability[],
  random: () => number = Math.random,
): number {
  const sample = Math.max(0, Math.min(0.999999999, random()));
  let cursor = 0;
  for (const choice of distribution) {
    cursor += choice.probability;
    if (sample < cursor) return choice.rank;
  }
  return distribution.at(-1)?.rank ?? 1;
}

/**
 * Samples one drop, refusing `avoidRank` (when alternatives exist) so the
 * caller can enforce a cap on consecutive identical atoms.
 */
export function pickSpawnRank(
  context: SpawnContext,
  avoidRank: number | null,
  random: () => number = Math.random,
): number {
  const distribution = getSpawnDistribution(context);
  let rank = pickRankFromDistribution(distribution, random);
  if (avoidRank !== null && rank === avoidRank && distribution.length > 1) {
    const alternatives = distribution.filter((item) => item.rank !== rank);
    rank = pickRankFromDistribution(alternatives, random);
  }
  return rank;
}

export function calculateMergeScore(
  resultRank: number,
  combo: number,
): number {
  const safeRank = Math.max(
    1,
    Math.min(MAX_ELEMENT_RANK, Math.floor(resultRank)),
  );
  const safeCombo = Math.max(1, Math.floor(combo));
  const multiplier = 1 + Math.min(4, safeCombo - 1) * 0.25;
  return Math.round(safeRank ** 2 * 10 * multiplier);
}

export function advanceDangerTimer(
  currentSeconds: number,
  dangerActive: boolean,
  deltaSeconds: number,
): number {
  const delta = Math.max(0, deltaSeconds);
  if (dangerActive) return currentSeconds + delta;
  return Math.max(0, currentSeconds - delta * 2.5);
}

export function canUseTool(
  inventory: Readonly<ToolInventory>,
  tool: ToolKind,
): boolean {
  return inventory[tool] > 0;
}

export function consumeTool(
  inventory: Readonly<ToolInventory>,
  tool: ToolKind,
): ToolInventory {
  if (!canUseTool(inventory, tool)) return { ...inventory };
  return {
    ...inventory,
    [tool]: inventory[tool] - 1,
  };
}

export function pickToolReward(
  random: () => number = Math.random,
): ToolKind {
  const sample = Math.max(0, Math.min(0.999999999, random()));
  return TOOL_KINDS[Math.floor(sample * TOOL_KINDS.length)] ?? "proton";
}

export function addTool(
  inventory: Readonly<ToolInventory>,
  tool: ToolKind,
  amount = 1,
): ToolInventory {
  return {
    ...inventory,
    [tool]: inventory[tool] + Math.max(0, Math.floor(amount)),
  };
}
