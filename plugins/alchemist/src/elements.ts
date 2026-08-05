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
 * accurate metadata. Radii follow the proportions of classic fruit-merge
 * games mapped onto the 336px chamber: droppable ranks stay small (largest
 * droppable is ~26% of the chamber width), the final gold atom spans ~57%,
 * and two silver atoms still fit side by side so the last merge is always
 * physically possible.
 */
export const ELEMENTS: readonly ElementData[] = [
  element(1, 1, "H", 13, "#9b8ec4", "#eae3ff", "#55488c"),
  element(2, 6, "C", 19, "#5f6b77", "#d3dbe3", "#313c46"),
  element(3, 7, "N", 25, "#4187c6", "#c8e4ff", "#1e4f7f"),
  element(4, 8, "O", 30, "#d8514a", "#ffcaba", "#8c2a26"),
  element(5, 15, "P", 36, "#e5852f", "#ffd8a1", "#94491c"),
  element(6, 16, "S", 43, "#ddb02e", "#fff0a3", "#85641a"),
  element(7, 17, "Cl", 50, "#57a552", "#cdeeb6", "#2b6329"),
  element(8, 19, "K", 60, "#8a63c9", "#e0d0ff", "#4a3390"),
  element(9, 26, "Fe", 71, "#a05a43", "#e3bfa9", "#59301f"),
  element(10, 47, "Ag", 82, "#a8b2bd", "#eef3f8", "#5c6773"),
  element(11, 79, "Au", 95, "#e0a83c", "#ffeaa6", "#8a5c14"),
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
