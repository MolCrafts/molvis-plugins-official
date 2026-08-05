/** Tiny inline SVG icons — no lucide dep inside the plugin bundle. */

const base = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function IconPlay() {
  return (
    <svg {...base}>
      <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPlayAll() {
  return (
    <svg {...base}>
      <polygon points="4 4 14 12 4 20 4 4" fill="currentColor" stroke="none" />
      <line x1="18" y1="5" x2="18" y2="19" />
      <line x1="21" y1="5" x2="21" y2="19" />
    </svg>
  );
}

/** Run this cell and everything after it: play, then the rows below. */
export function IconPlayBelow() {
  return (
    <svg {...base}>
      <polygon points="4 3 13 8.5 4 14 4 3" fill="currentColor" stroke="none" />
      <line x1="17" y1="4" x2="21" y2="4" />
      <line x1="17" y1="8.5" x2="21" y2="8.5" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <line x1="3" y1="21.5" x2="21" y2="21.5" />
    </svg>
  );
}

/**
 * Kernel status glyphs — Jupyter-style status circles, not power switches.
 * idle → hollow ring · ready → solid disc · error → ring + X
 */
export function IconKernelIdle() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="7" stroke="currentColor" fill="none" />
    </svg>
  );
}

export function IconKernelReady() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconKernelError() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" fill="none" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  );
}

export function IconPlus() {
  return (
    <svg {...base}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconTrash() {
  return (
    <svg {...base}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export function IconStop() {
  return <svg {...base}><rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" /></svg>;
}

export function IconCheck() {
  return <svg {...base}><polyline points="5 12 10 17 19 7" /></svg>;
}

export function IconX() {
  return <svg {...base}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>;
}

export function IconDownload() {
  return (
    <svg {...base}>
      <path d="M12 3v12" />
      <polyline points="7 10 12 15 17 10" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function IconRefresh() {
  return (
    <svg {...base}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

export function IconEraser() {
  return (
    <svg {...base}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}

/**
 * Indeterminate spinner.
 *
 * Uses SVG SMIL (`animateTransform`) rather than CSS `@keyframes`:
 * the host stylesheet forces `animation: none !important` under
 * `prefers-reduced-motion`, and CSS transforms on bare `<svg>` are
 * flaky without `transform-box`. SMIL is self-contained — no global
 * stylesheet injection required.
 */
export function IconSpinner() {
  return (
    <svg {...base}>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity={0.25}
        fill="none"
      />
      {/* Rotate the arc around the viewBox centre (12, 12). */}
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.7s"
          repeatCount="indefinite"
        />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" fill="none" />
      </g>
    </svg>
  );
}
