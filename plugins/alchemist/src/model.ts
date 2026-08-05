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

/**
 * Every run starts empty-handed: tools are earned in play (glowing atoms),
 * never granted up front.
 */
export const INITIAL_TOOLS: Readonly<ToolInventory> = {
  proton: 0,
  compress: 0,
  fusion: 0,
  decay: 0,
};

export interface BoltzmannProbability {
  readonly rank: number;
  readonly probability: number;
}

export function nextElement(rank: number): number | null {
  return rank >= MAX_ELEMENT_RANK ? null : rank + 1;
}

/**
 * Static drop pool calibrated against observed spawn counts from reference
 * merge games. Only the first five ranks can drop; everything above must be
 * synthesized. This avoids shortcutting a large part of the progression by
 * handing the player rank-six atoms directly.
 */
export const BASE_DROP_WEIGHTS: readonly number[] = [35, 25, 20, 14, 6];
export const MAX_CONSECUTIVE_DROPS = 3;

export interface SpawnContext {
  /** True when the chamber stack has passed 75% of its height. */
  crowded: boolean;
}

export function getSpawnDistribution(
  context: SpawnContext,
): BoltzmannProbability[] {
  const weights = new Map<number, number>();
  for (let index = 0; index < BASE_DROP_WEIGHTS.length; index += 1) {
    weights.set(1 + index, BASE_DROP_WEIGHTS[index] ?? 0);
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
