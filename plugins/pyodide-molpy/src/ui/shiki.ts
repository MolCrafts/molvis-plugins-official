import { SHIKI_ESM_URL } from "../cdn";

type ShikiHighlighter = {
  codeToTokens: (
    source: string,
    options: { lang: "python"; theme: "github-light" | "github-dark" },
  ) => { tokens: HighlightedLine[] };
};

export type HighlightedToken = {
  content: string;
  color?: string;
  fontStyle?: number;
};
export type HighlightedLine = HighlightedToken[];

type ShikiModule = {
  createHighlighter: (options: {
    themes: string[];
    langs: string[];
  }) => Promise<ShikiHighlighter>;
};

let highlighterPromise: Promise<ShikiHighlighter> | null = null;
const cache = new Map<string, HighlightedLine[]>();

function loadHighlighter(): Promise<ShikiHighlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      SHIKI_ESM_URL
    ).then((raw) => {
      const shiki = ((raw as { default?: ShikiModule }).default ??
        raw) as ShikiModule;
      return shiki.createHighlighter({
        themes: ["github-light", "github-dark"],
        langs: ["python"],
      });
    });
  }
  return highlighterPromise;
}

/** Cached, shared Shiki rendering. Shiki escapes source before producing HTML. */
export async function highlightPython(
  source: string,
  dark: boolean,
): Promise<HighlightedLine[]> {
  const theme = dark ? "github-dark" : "github-light";
  const key = `${theme}:${source}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const highlighter = await loadHighlighter();
  const lines = highlighter.codeToTokens(source || " ", {
    lang: "python",
    theme,
  }).tokens;
  cache.set(key, lines);
  if (cache.size > 250) cache.delete(cache.keys().next().value ?? "");
  return lines;
}
