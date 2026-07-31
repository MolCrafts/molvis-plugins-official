import { MAX_ELEMENT_RANK } from "./elements";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SavedProgress {
  bestScore: number;
  discovered: number[];
  muted: boolean;
}

const DEFAULT_PROGRESS: Readonly<SavedProgress> = {
  bestScore: 0,
  discovered: [1],
  muted: false,
};

const KEYS = {
  bestScore: "bestScore",
  discovered: "discovered",
  muted: "muted",
} as const;

export class NamespacedLocalStorage implements StorageAdapter {
  constructor(private readonly namespace = "alchemist:") {}

  getItem(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(`${this.namespace}${key}`) ?? null;
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(`${this.namespace}${key}`, value);
    } catch {
      // Private browsing and embedded hosts can reject writes.
    }
  }
}

function parseNonNegativeInteger(value: string | null): number {
  if (value === null) return 0;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function parseDiscovered(value: string | null): number[] {
  if (value === null) return [...DEFAULT_PROGRESS.discovered];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [...DEFAULT_PROGRESS.discovered];
    const valid = parsed
      .filter(
        (item): item is number =>
          Number.isInteger(item) && item >= 1 && item <= MAX_ELEMENT_RANK,
      )
      .filter((item, index, items) => items.indexOf(item) === index)
      .sort((a, b) => a - b);
    return valid.includes(1) ? valid : [1, ...valid];
  } catch {
    return [...DEFAULT_PROGRESS.discovered];
  }
}

export function loadProgress(storage: StorageAdapter): SavedProgress {
  try {
    return {
      bestScore: parseNonNegativeInteger(storage.getItem(KEYS.bestScore)),
      discovered: parseDiscovered(storage.getItem(KEYS.discovered)),
      muted: storage.getItem(KEYS.muted) === "true",
    };
  } catch {
    return {
      bestScore: DEFAULT_PROGRESS.bestScore,
      discovered: [...DEFAULT_PROGRESS.discovered],
      muted: DEFAULT_PROGRESS.muted,
    };
  }
}

export function saveBestScore(
  storage: StorageAdapter,
  bestScore: number,
): void {
  storage.setItem(KEYS.bestScore, String(Math.max(0, Math.floor(bestScore))));
}

export function saveDiscovered(
  storage: StorageAdapter,
  discovered: Iterable<number>,
): void {
  const values = [...new Set(discovered)]
    .filter(
      (item) =>
        Number.isInteger(item) && item >= 1 && item <= MAX_ELEMENT_RANK,
    )
    .sort((a, b) => a - b);
  storage.setItem(KEYS.discovered, JSON.stringify(values));
}

export function saveMuted(storage: StorageAdapter, muted: boolean): void {
  storage.setItem(KEYS.muted, String(muted));
}
