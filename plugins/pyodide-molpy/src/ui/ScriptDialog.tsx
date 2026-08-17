import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteScript,
  getScriptSource,
  listScriptNames,
  loadLibrary,
  normalizeScriptName,
  saveLibrary,
  scriptsMap,
  upsertScript,
  type ScriptLibrary,
} from "../model/scripts";
import type { PluginStorage } from "@molcrafts/molvis-plugin";
import { useKernel } from "./hooks/useKernel";
import { loadMonaco, type MonacoEditor } from "./monaco";
import { css } from "./styles";
import { monacoThemeId, tokens, watchHostTheme } from "./theme";

/**
 * Script library editor — **only** place Monaco is used.
 * Named scripts are runnable via ``mv.run("camera.py")`` in notebook/kernel.
 */
export function ScriptDialog({
  storage,
  close,
}: {
  app: unknown;
  storage: PluginStorage | null;
  close: () => void;
}) {
  const { status, run, runNamedScript, start, syncScripts } = useKernel();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const [lib, setLib] = useState<ScriptLibrary>(() => loadLibrary(storage));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editorReady, setEditorReady] = useState(false);
  const [fallback, setFallback] = useState("");
  const [newName, setNewName] = useState("");

  const activeSource =
    getScriptSource(lib, lib.active) ?? "# empty script\n";

  const persist = useCallback(
    (next: ScriptLibrary) => {
      setLib(next);
      saveLibrary(storage, next);
      void syncScripts(scriptsMap(next));
    },
    [storage, syncScripts],
  );

  // Initial sync into kernel (even before start).
  useEffect(() => {
    void syncScripts(scriptsMap(lib));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once with initial lib
  }, []);

  // Monaco setup — re-create only on storage identity, not every active switch.
  useEffect(() => {
    let cancelled = false;
    setFallback(activeSource);

    void (async () => {
      try {
        const monaco = await loadMonaco();
        if (cancelled || !hostRef.current) return;
        if (editorRef.current) {
          editorRef.current.setValue(activeSource);
          setEditorReady(true);
          return;
        }
        const editor = monaco.editor.create(hostRef.current, {
          value: activeSource,
          language: "python",
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          wordWrap: "on",
          scrollBeyondLastLine: false,
          theme: monacoThemeId(),
        });
        editorRef.current = editor;
        setEditorReady(true);
        editor.onDidChangeModelContent(() => {
          const source = editor.getValue();
          setLib((prev) => {
            const next = upsertScript(prev, prev.active, source);
            saveLibrary(storage, next);
            void syncScripts(scriptsMap(next));
            return next;
          });
        });
      } catch {
        setEditorReady(false);
      }
    })();

    const unwatch = watchHostTheme(() => {
      // Monaco global theme — re-apply when host toggles .dark.
      void loadMonaco().then((monaco) => {
        try {
          monaco.editor.setTheme?.(monacoThemeId());
        } catch {
          /* ignore */
        }
      });
    });

    return () => {
      cancelled = true;
      unwatch();
    };
    // Only bootstrap once; active file switches handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage]);

  // Switch file in editor
  useEffect(() => {
    const src = getScriptSource(lib, lib.active) ?? "";
    setFallback(src);
    if (editorRef.current) {
      const cur = editorRef.current.getValue();
      if (cur !== src) editorRef.current.setValue(src);
    }
  }, [lib.active]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional

  useEffect(() => {
    return () => {
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []);

  const getCode = () => editorRef.current?.getValue() ?? fallback;

  const saveCurrent = () => {
    const source = getCode();
    persist(upsertScript(lib, lib.active, source));
    setMessage(`Saved ${lib.active}`);
  };

  const onRunFile = async () => {
    saveCurrent();
    setBusy(true);
    setMessage(`Running ${lib.active}…`);
    try {
      await start();
      await syncScripts(scriptsMap(lib));
      const result = await runNamedScript(lib.active);
      setMessage(
        result.ok
          ? `Done ${lib.active} — see Console`
          : result.error ?? "Error",
      );
    } finally {
      setBusy(false);
    }
  };

  const onRunViaMv = async () => {
    saveCurrent();
    setBusy(true);
    setMessage(`mv.run(${JSON.stringify(lib.active)})…`);
    try {
      await start();
      await syncScripts(scriptsMap(lib));
      const result = await run(
        `import molvis as mv\nmv.run(${JSON.stringify(lib.active)})`,
        "script",
      );
      setMessage(
        result.ok ? `mv.run done — see Console` : result.error ?? "Error",
      );
    } finally {
      setBusy(false);
    }
  };

  const names = listScriptNames(lib);

  return (
    <div style={css.scriptBody}>
      <div style={css.toolbar}>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ opacity: 0.7 }}>File</span>
          <select
            value={lib.active}
            onChange={(e) => {
              const name = e.target.value;
              // flush current buffer before switch
              const source = getCode();
              const flushed = upsertScript(lib, lib.active, source);
              persist({ ...flushed, active: name });
            }}
            style={{
              fontSize: 12,
              padding: "2px 6px",
              borderRadius: 4,
              border: `1px solid ${tokens.border}`,
              maxWidth: 160,
            }}
          >
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <input
          type="text"
          placeholder="new.py"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{
            width: 90,
            fontSize: 12,
            padding: "2px 6px",
            borderRadius: 4,
            border: `1px solid ${tokens.border}`,
          }}
        />
        <button
          type="button"
          style={css.btn()}
          onClick={() => {
            if (!newName.trim()) return;
            const name = normalizeScriptName(newName);
            const source = getCode();
            const flushed = upsertScript(lib, lib.active, source);
            persist(
              upsertScript(flushed, name, `# ${name}\nprint("new script")\n`),
            );
            setNewName("");
            setMessage(`Created ${name}`);
          }}
        >
          New
        </button>
        <button type="button" style={css.btn()} onClick={saveCurrent}>
          Save
        </button>
        <button
          type="button"
          style={css.btn()}
          onClick={() => {
            if (!globalThis.confirm?.(`Delete ${lib.active}?`)) return;
            persist(deleteScript(lib, lib.active));
          }}
        >
          Delete
        </button>
        <button
          type="button"
          style={css.btn("primary")}
          disabled={busy || status === "busy"}
          onClick={() => void onRunFile()}
        >
          Run
        </button>
        <button
          type="button"
          style={css.btn("primary")}
          disabled={busy || status === "busy"}
          title='import molvis as mv; mv.run("…")'
          onClick={() => void onRunViaMv()}
        >
          mv.run
        </button>
        <button type="button" style={css.btn()} onClick={close}>
          Close
        </button>
        <span style={css.status}>
          {message || `kernel: ${status}`} · Monaco · Mod+Enter
          {!editorReady ? " · textarea fallback" : ""}
        </span>
      </div>
      <div
        style={{
          padding: "4px 10px",
          fontSize: 11,
          opacity: 0.75,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        Call from notebook:{" "}
        <code>{`import molvis as mv; mv.run("${lib.active}")`}</code>
      </div>
      <div style={css.scriptEditor}>
        <div
          ref={hostRef}
          style={{
            ...css.monacoBox,
            display: editorReady ? "block" : "none",
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void onRunFile();
            }
          }}
        />
        {!editorReady && (
          <textarea
            style={{ ...css.textarea, height: "100%", minHeight: 280 }}
            value={fallback}
            spellCheck={false}
            onChange={(e) => {
              setFallback(e.target.value);
              persist(upsertScript(lib, lib.active, e.target.value));
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void onRunFile();
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
