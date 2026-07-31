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
 * Compact gameplay progression.
 *
 * Rank controls synthesis order while atomicNumber remains scientifically
 * accurate metadata. Radii are deliberately game-scaled with growing diameter
 * steps so every rank reads clearly at a glance: the second-largest atom
 * spans more than half the chamber width, and the top ranks feel massive.
 */
export const ELEMENTS: readonly ElementData[] = [
  element(1, 1, "H", 20, "#7560b5", "#ded2ff", "#42307c"),
  element(2, 6, "C", 29, "#53616d", "#d0d8df", "#293640"),
  element(3, 7, "N", 40, "#3f7eae", "#c3e2ff", "#224d7b"),
  element(4, 8, "O", 53, "#d7544d", "#ffd0bd", "#902b2e"),
  element(5, 15, "P", 68, "#e18835", "#ffd9a5", "#99491d"),
  element(6, 16, "S", 85, "#c5a12f", "#fff0a9", "#766017"),
  element(7, 19, "K", 105, "#6657ad", "#d5c9ff", "#342a74"),
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
