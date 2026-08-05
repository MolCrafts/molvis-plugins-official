import { useEffect, useRef, useState } from "react";
import { loadMonaco, type MonacoEditor } from "./monaco";
import { monacoThemeId } from "./theme";

const MIN_HEIGHT = 58;
const MAX_HEIGHT = 700;

type SavedViewState = {
  cursor?: { lineNumber: number; column: number };
  scrollTop?: number;
  scrollLeft?: number;
};

const viewStates = new Map<string, SavedViewState>();

export function MonacoCellEditor({
  cellId,
  source,
  wordWrap,
  onChange,
  onRun,
  onRunAndAdvance,
  onRunAndInsert,
  onLeaveEditMode,
  onToggleWordWrap,
}: {
  cellId: string;
  source: string;
  wordWrap: boolean;
  onChange: (source: string) => void;
  onRun: (source: string) => void;
  onRunAndAdvance: (source: string) => void;
  onRunAndInsert: (source: string) => void;
  onLeaveEditMode: () => void;
  onToggleWordWrap: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const onChangeRef = useRef(onChange);
  const callbacksRef = useRef({
    onRun,
    onRunAndAdvance,
    onRunAndInsert,
    onLeaveEditMode,
    onToggleWordWrap,
  });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  onChangeRef.current = onChange;
  callbacksRef.current = {
    onRun,
    onRunAndAdvance,
    onRunAndInsert,
    onLeaveEditMode,
    onToggleWordWrap,
  };

  useEffect(() => {
    let cancelled = false;
    let changeTimer: ReturnType<typeof setTimeout> | null = null;
    let latest = source;

    void loadMonaco().then((monaco) => {
      if (cancelled || !hostRef.current) return;
      const editor = monaco.editor.create(hostRef.current, {
        value: source,
        language: "python",
        theme: monacoThemeId(),
        minimap: { enabled: false },
        lineNumbers: "on",
        lineNumbersMinChars: 2,
        lineDecorationsWidth: 4,
        glyphMargin: false,
        folding: false,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: wordWrap ? "on" : "off",
        renderWhitespace: "selection",
        tabSize: 4,
        insertSpaces: true,
        detectIndentation: false,
        fontLigatures: true,
        fontFamily:
          '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
        fontSize: 13,
        lineHeight: 20,
        padding: { top: 10, bottom: 10 },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        parameterHints: { enabled: false },
        stickyScroll: { enabled: false },
        scrollbar: { vertical: "auto", alwaysConsumeMouseWheel: false },
      });
      editorRef.current = editor;

      const resize = () => {
        const host = hostRef.current;
        if (!host) return;
        const height = Math.max(
          MIN_HEIGHT,
          Math.min(editor.getContentHeight(), MAX_HEIGHT),
        );
        host.style.height = `${height}px`;
        editor.layout({ width: host.clientWidth, height });
      };
      resize();
      editor.onDidContentSizeChange(resize);
      editor.onDidChangeModelContent(() => {
        latest = editor.getValue();
        if (changeTimer) clearTimeout(changeTimer);
        changeTimer = setTimeout(() => onChangeRef.current(latest), 75);
        resize();
      });
      editor.onDidBlurEditorWidget(() => {
        if (changeTimer) clearTimeout(changeTimer);
        changeTimer = null;
        latest = editor.getValue();
        onChangeRef.current(latest);
      });

      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () =>
        callbacksRef.current.onRunAndAdvance(editor.getValue()),
      );
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
        callbacksRef.current.onRun(editor.getValue()),
      );
      editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, () =>
        callbacksRef.current.onRunAndInsert(editor.getValue()),
      );
      editor.addCommand(monaco.KeyCode.Escape, () =>
        callbacksRef.current.onLeaveEditMode(),
      );
      editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () =>
        callbacksRef.current.onToggleWordWrap(),
      );

      const saved = viewStates.get(cellId);
      if (saved?.cursor) editor.setPosition(saved.cursor);
      editor.setScrollPosition(saved ?? {});
      editor.focus();
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setLoading(false);
        setFailed(true);
      }
    });

    return () => {
      cancelled = true;
      if (changeTimer) clearTimeout(changeTimer);
      const editor = editorRef.current;
      if (editor) {
        onChangeRef.current(editor.getValue());
        viewStates.set(cellId, {
          cursor: editor.getPosition() ?? undefined,
          scrollTop: editor.getScrollTop(),
          scrollLeft: editor.getScrollLeft(),
        });
        editor.dispose();
        editorRef.current = null;
      }
    };
  }, [cellId]);

  useEffect(() => {
    editorRef.current?.updateOptions({ wordWrap: wordWrap ? "on" : "off" });
  }, [wordWrap]);

  return (
    <div className="molvis-monaco-cell-wrap">
      {loading ? <pre className="molvis-monaco-fallback">{source || " "}</pre> : null}
      {failed ? (
        <div role="alert" className="molvis-monaco-fallback" style={{ position: "relative", inset: "auto" }}>
          Monaco editor failed to load.
        </div>
      ) : <div ref={hostRef} className="molvis-monaco-cell" />}
    </div>
  );
}
