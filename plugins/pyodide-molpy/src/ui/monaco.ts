/**
 * Lazy Monaco loader (CDN ESM). Avoids bundling the editor into plugin.js.
 */

export type MonacoEditor = {
  getValue: () => string;
  setValue: (v: string) => void;
  dispose: () => void;
  onDidChangeModelContent: (cb: () => void) => { dispose: () => void };
  layout: () => void;
};

type MonacoNS = {
  editor: {
    create: (
      el: HTMLElement,
      opts: Record<string, unknown>,
    ) => MonacoEditor;
  };
};

let monacoPromise: Promise<MonacoNS> | null = null;

export function loadMonaco(): Promise<MonacoNS> {
  if (!monacoPromise) {
    const url = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/+esm";
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
