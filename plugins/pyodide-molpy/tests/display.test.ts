import { describe, expect, it } from "@rstest/core";
import {
  isHtmlishMime,
  isImageMime,
  MIME_DISPLAY_ORDER,
  preferredMime,
} from "../src/kernel/display";
import type { MimeBundle } from "../src/kernel/types";

describe("preferredMime (IPython order)", () => {
  it("prefers text/html over text/plain", () => {
    const data: MimeBundle = {
      "text/plain": "Frame(...)",
      "text/html": "<table></table>",
    };
    expect(preferredMime(data)).toBe("text/html");
  });

  it("falls back to text/plain", () => {
    expect(preferredMime({ "text/plain": "42" })).toBe("text/plain");
  });

  it("prefers png over plain", () => {
    const data: MimeBundle = {
      "text/plain": "<Image>",
      "image/png": "AAAA",
    };
    expect(preferredMime(data)).toBe("image/png");
  });

  it("returns null for empty bundle", () => {
    expect(preferredMime({})).toBe(null);
    expect(preferredMime(undefined)).toBe(null);
  });

  it("lists IPython default types in the expected order", () => {
    expect(MIME_DISPLAY_ORDER[0]).toBe("text/html");
    expect(MIME_DISPLAY_ORDER[MIME_DISPLAY_ORDER.length - 1]).toBe(
      "text/plain",
    );
  });
});

describe("mime helpers", () => {
  it("classifies image and html-ish types", () => {
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("text/plain")).toBe(false);
    expect(isHtmlishMime("text/html")).toBe(true);
    expect(isHtmlishMime("image/svg+xml")).toBe(true);
    expect(isHtmlishMime("image/png")).toBe(false);
  });
});
