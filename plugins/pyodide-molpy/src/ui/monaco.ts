import { MONACO_ESM_URL } from "../cdn";
/**
 * Lazy Monaco loader (CDN ESM). Avoids bundling the editor into plugin.js.
 */

export type MonacoEditor = {
  getValue: () => string;
  setValue: (v: string) => void;
  dispose: () => void;
  onDidChangeModelContent: (cb: () => void) => { dispose: () => void };
  onDidBlurEditorWidget: (cb: () => void) => { dispose: () => void };
  layout: (dimension?: { width: number; height: number }) => void;
  getContentHeight: () => number;
  getPosition: () => { lineNumber: number; column: number } | null;
  setPosition: (position: { lineNumber: number; column: number }) => void;
  getScrollTop: () => number;
  getScrollLeft: () => number;
  setScrollPosition: (position: { scrollTop?: number; scrollLeft?: number }) => void;
  focus: () => void;
  addCommand: (keybinding: number, handler: () => void) => string | null;
  onDidContentSizeChange: (cb: () => void) => { dispose: () => void };
  updateOptions: (options: Record<string, unknown>) => void;
};

export type MonacoNS = {
  KeyMod: { CtrlCmd: number; Shift: number; Alt: number };
  KeyCode: { Enter: number; Escape: number; Space: number; KeyZ: number };
  editor: {
    create: (
      el: HTMLElement,
      opts: Record<string, unknown>,
    ) => MonacoEditor;
    setTheme?: (theme: string) => void;
  };
};

let monacoPromise: Promise<MonacoNS> | null = null;

export function loadMonaco(): Promise<MonacoNS> {
  if (!monacoPromise) {
    const url = MONACO_ESM_URL;
    monacoPromise = import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      url
    ).then((mod) => {
      // esm build may nest default
      const m = (mod as { default?: MonacoNS }).default ?? (mod as MonacoNS);
      return m;
    });
  }
  return monacoPromise;
}
