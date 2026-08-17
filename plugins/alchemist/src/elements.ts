export interface ElementData {
  readonly rank: number;
  readonly atomicNumber: number;
  readonly symbol: string;
  readonly radius: number;
  readonly color: string;
  readonly lightColor: string;
  readonly darkColor: string;
}

function element(
  rank: number,
  atomicNumber: number,
  symbol: string,
  radius: number,
  color: string,
  lightColor: string,
  darkColor: string,
): ElementData {
  return {
    rank,
    atomicNumber,
    symbol,
    radius,
    color,
    lightColor,
    darkColor,
  };
}

/**
 * Eleven-rank progression ending on the alchemist's goal: gold.
 *
 * Rank controls synthesis order while atomicNumber remains scientifically
 * accurate metadata. Radii follow fruit-merge proportions on the 336px
 * chamber, with C / N / O (the common mid-game stack) oversized so a short
 * run actually fills the flask. Largest droppable stays under 30% of the
 * chamber width; gold spans ~57%; two silver atoms still fit side by side
 * so the last merge is always physically possible.
 *
 * Colors are CPK-leaning so the beads read as atoms, not fruit.
 */
export const ELEMENTS: readonly ElementData[] = [
  element(1, 1, "H", 13, "#c9bddc", "#f6f1ff", "#5c5278"),
  element(2, 6, "C", 23, "#3a3f46", "#9aa3ad", "#16191d"),
  element(3, 7, "N", 30, "#2f5fd0", "#9ec0ff", "#16357a"),
  element(4, 8, "O", 37, "#e23b32", "#ffb2a4", "#8a1612"),
  element(5, 15, "P", 44, "#e87a1c", "#ffd09a", "#8a3f0d"),
  element(6, 16, "S", 51, "#e0c01a", "#fff3a8", "#7a6410"),
  element(7, 17, "Cl", 58, "#2faf3a", "#b6f0b0", "#14601a"),
  element(8, 19, "K", 66, "#8a4fd4", "#ddc2ff", "#4a2188"),
  element(9, 26, "Fe", 74, "#c45a2c", "#f0b48e", "#6a2410"),
  element(10, 47, "Ag", 82, "#b7c0c9", "#f3f6f8", "#4e5862"),
  element(11, 79, "Au", 95, "#e4b03a", "#ffe79a", "#8a5a10"),
] as const;

export const MAX_ELEMENT_RANK = ELEMENTS.length;

export function getElement(rank: number): ElementData {
  const value = ELEMENTS[rank - 1];
  if (!value) {
    throw new RangeError(`Unknown element rank: ${rank}`);
  }
  return value;
}

export function radiusFor(rank: number): number {
  return getElement(rank).radius;
}
