/**
 * Jupyter DisplayFormatter — frontend side.
 *
 * Matches IPython's published MIME priority for choosing one representation
 * to render when several are available on a bundle.
 */

import type { MimeBundle } from "./types";

/** IPython.core.formatters default active types, richest first. */
export const MIME_DISPLAY_ORDER = [
  "text/html",
  "text/markdown",
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "text/latex",
  "application/json",
  "application/javascript",
  "text/plain",
] as const;

export type DisplayMime = (typeof MIME_DISPLAY_ORDER)[number];

/** Pick the richest mime type present on a bundle. */
export function preferredMime(data: MimeBundle | null | undefined): string | null {
  if (!data) return null;
  for (const mime of MIME_DISPLAY_ORDER) {
    if (data[mime] != null && data[mime] !== "") return mime;
  }
  // Unknown types: first non-empty key
  for (const [k, v] of Object.entries(data)) {
    if (v != null && v !== "") return k;
  }
  return null;
}

export function isImageMime(mime: string): boolean {
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/gif";
}

export function isHtmlishMime(mime: string): boolean {
  return mime === "text/html" || mime === "image/svg+xml";
}
