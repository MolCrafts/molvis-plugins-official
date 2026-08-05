/**
 * Resolve MolVis host design tokens for canvas/xterm/Monaco.
 *
 * Host CSS uses oklch tokens (`--molvis-panel`, …). xterm/Monaco need
 * concrete colors; we probe via a temporary node so the browser returns
 * computed `rgb(...)` that works on canvas.
 */

import {
  type StatusName,
  statusToken,
  token,
  type TokenName,
} from "../types/contract_tokens";

export type XtermTheme = {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
};


/** True when the host document is in MolVis dark chrome. */
export function isHostDark(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  const body = document.body;
  return (
    root.classList.contains("dark") ||
    body?.classList.contains("dark") === true ||
    root.getAttribute("data-theme") === "dark" ||
    body?.getAttribute("data-theme") === "dark"
  );
}

/**
 * Resolve a CSS color expression (var / oklch / hex) to computed rgb().
 */
export function resolveCssColor(
  parent: Element | null,
  cssValue: string,
  fallback: string,
): string {
  if (typeof document === "undefined") return fallback;
  const host = parent ?? document.body ?? document.documentElement;
  if (!host) return fallback;
  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;left:-9999px;top:0;pointer-events:none;color:" +
    cssValue;
  host.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  host.removeChild(probe);
  if (!resolved || resolved === "rgba(0, 0, 0, 0)" || resolved === "transparent") {
    return fallback;
  }
  return resolved;
}

/**
 * Concrete `rgb()` for a host token, for surfaces that cannot consume
 * `var()` (xterm, canvas, Monaco). The CSS expression comes from the shared
 * token table; only the oklch→rgb probe is local.
 */
function resolveColor(parent: Element | null, name: TokenName): string {
  const css = token(name);
  return resolveCssColor(parent, css, css);
}

function resolveStatusColor(parent: Element | null, name: StatusName): string {
  const css = statusToken(name);
  return resolveCssColor(parent, css, css);
}

/**
 * CSS var strings for inline React styles.
 *
 * Delegates to the vendored token table so this plugin, the LAMMPS plugin and
 * the host cannot disagree. The old local copy kept a second `rgb()` table for
 * canvas/xterm that had to be edited in lockstep — `resolveToken` reads the
 * live computed value instead, so the terminal now follows the host theme.
 */
export const tokens = {
  panel: token("panel"),
  panelRaised: token("panelRaised"),
  muted: token("muted"),
  fg: token("foreground"),
  mutedFg: token("mutedForeground"),
  subtleFg: token("subtleForeground"),
  border: token("border"),
  accent: token("accent"),
  accentFg: token("accentForeground"),
  interactive: token("interactive"),
  failed: statusToken("failed"),
  completed: statusToken("completed"),
  warning: statusToken("warning"),
  running: statusToken("running"),
  scrim: token("scrim"),
  shadow: token("shadowOverlay"),
} as const;

/** Build an xterm.js theme from host MolVis tokens. */
export function readXtermTheme(parent: Element | null): XtermTheme {
  const bg = resolveColor(parent, "panel");
  const raised = resolveColor(parent, "panelRaised");
  const fg = resolveColor(parent, "foreground");
  const muted = resolveColor(parent, "mutedForeground");
  const accent = resolveColor(parent, "accent");
  const red = resolveStatusColor(parent, "failed");
  const green = resolveStatusColor(parent, "completed");
  const yellow = resolveStatusColor(parent, "warning");
  const blue = resolveStatusColor(parent, "running");
  const dark = isHostDark();

  return {
    background: bg,
    foreground: fg,
    cursor: fg,
    cursorAccent: bg,
    selectionBackground: accent,
    selectionForeground: dark ? bg : fg,
    black: dark ? raised : muted,
    red,
    green,
    yellow,
    blue,
    magenta: blue,
    cyan: accent,
    white: fg,
    brightBlack: muted,
    brightRed: red,
    brightGreen: green,
    brightYellow: yellow,
    brightBlue: blue,
    brightMagenta: blue,
    brightCyan: accent,
    brightWhite: fg,
  };
}

/** Monaco built-in theme id matching host light/dark. */
export function monacoThemeId(): "vs" | "vs-dark" {
  return isHostDark() ? "vs-dark" : "vs";
}

/**
 * Observe host theme class changes (`.dark` on html/body) and call `onChange`.
 * Returns an unsubscribe function.
 */
export function watchHostTheme(onChange: () => void): () => void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return () => {};
  }
  const run = () => {
    try {
      onChange();
    } catch {
      /* ignore theme apply errors */
    }
  };
  const obs = new MutationObserver(run);
  const opts: MutationObserverInit = {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  };
  obs.observe(document.documentElement, opts);
  if (document.body) obs.observe(document.body, opts);

  // Fallback if host toggles color-scheme via media (rare for MolVis).
  const mql =
    typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-color-scheme: dark)")
      : null;
  const onMql = () => run();
  mql?.addEventListener?.("change", onMql);

  return () => {
    obs.disconnect();
    mql?.removeEventListener?.("change", onMql);
  };
}
