import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createCell,
  downloadNotebookIpynb,
  loadNotebook,
  saveNotebook,
  subscribeNotebookExternal,
  type NotebookCell,
  type NotebookState,
} from "../model/notebook";
import {
  isHtmlishMime,
  isImageMime,
  preferredMime,
} from "../kernel/display";
import type { MimeBundle, RunResult } from "../kernel/types";
import {
  saveEditorSettings,
  useEditorSettings,
} from "../model/editor_settings";
import { loadLibrary, scriptsMap } from "../model/scripts";
import type { PluginStorage } from "../types/plugin-api";
import { useKernel } from "./hooks/useKernel";
import { IconButton } from "./IconButton";
import { MonacoCellEditor } from "./MonacoCellEditor";
import { loadMonaco } from "./monaco";
import { ShikiCodeView } from "./ShikiCodeView";
import {
  IconKernelError,
  IconKernelIdle,
  IconKernelReady,
  IconPlay,
  IconPlayAll,
  IconPlayBelow,
  IconDownload,
  IconCheck,
  IconStop,
  IconX,
  IconSpinner,
  IconTrash,
} from "./icons";
import { css } from "./styles";
import { tokens } from "./theme";

/**
 * Inject keyframes once (plugin has no global stylesheet).
 * Kept for the optional CSS `css.spinner` div; IconSpinner uses SMIL.
 * Re-checks the DOM so HMR / head cleanup does not leave a dead flag.
 */
function ensureSpinKeyframes() {
  if (typeof document === "undefined") return;
  if (document.querySelector('style[data-molvis-nb="spin"]')) return;
  const el = document.createElement("style");
  el.setAttribute("data-molvis-nb", "spin");
  el.textContent = `
@keyframes molvis-nb-spin{to{transform:rotate(360deg)}}
.molvis-shiki-code,.molvis-monaco-fallback{min-height:58px;box-sizing:border-box;overflow:auto;font-family:"JetBrains Mono","SFMono-Regular",Consolas,monospace;font-size:13px;line-height:20px;tab-size:4}
.molvis-shiki-code>div{padding:10px 0;min-width:max-content}
.molvis-shiki-code>div.is-wrapped{min-width:0}
.molvis-shiki-line{display:grid;grid-template-columns:32px minmax(0,1fr);padding-right:14px;min-height:20px}
.molvis-shiki-line::before{content:attr(data-line-number);padding-right:8px;text-align:right;color:var(--molvis-muted-foreground);opacity:.65;user-select:none}
.molvis-shiki-line-code{white-space:pre}
.molvis-shiki-code>div.is-wrapped .molvis-shiki-line-code{white-space:pre-wrap;overflow-wrap:anywhere}
.molvis-shiki-code>pre,.molvis-monaco-fallback{margin:0;padding:10px 14px 10px 32px;background:transparent!important;box-sizing:border-box}
.molvis-shiki-code{cursor:text;color:inherit}
.molvis-monaco-cell-wrap{position:relative;min-height:58px}
.molvis-monaco-cell{width:100%;min-height:58px}
.molvis-monaco-fallback{position:absolute;inset:0;z-index:1;color:inherit;white-space:pre-wrap}
`;
  document.head.appendChild(el);
}

const ANSI_ESCAPE = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

function formatOutputText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(ANSI_ESCAPE, "")
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/g, ""))
    .join("\n")
    .trimEnd();
}

function formatOutputParts(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .map(formatOutputText)
    .filter(Boolean)
    .join("\n");
}

/**
 * Python notebook — same chrome language as MolVis Select/View tool panels.
 * Icon-only toolbar; cells are hairline rows (no cards, no filled buttons).
 */
export function NotebookPanel({
  storage,
}: {
  app: unknown;
  storage: PluginStorage | null;
}) {
  const { status, run, start, reset, interrupt, syncScripts } = useKernel();
  const [nb, setNb] = useState<NotebookState>(() => loadNotebook(storage));
  const nbRef = useRef(nb);
  nbRef.current = nb;
  /** Cell the run buttons act on; set by focusing or clicking a cell. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [monacoError, setMonacoError] = useState<string | null>(null);
  const editorSettings = useEditorSettings(storage);
  const deleteKeyAt = useRef(0);

  const toggleWordWrap = useCallback(() => {
    saveEditorSettings(storage, { wordWrap: !editorSettings.wordWrap });
  }, [editorSettings.wordWrap, storage]);

  useEffect(() => {
    void syncScripts(scriptsMap(loadLibrary(storage)));
  }, [storage, syncScripts]);

  // "IPython: Demo" (and any other external reset) reloads from storage.
  useEffect(() => {
    return subscribeNotebookExternal(() => {
      setNb(loadNotebook(storage));
    });
  }, [storage]);

  const persist = useCallback(
    (next: NotebookState) => {
      nbRef.current = next;
      setNb(next);
      saveNotebook(storage, next);
    },
    [storage],
  );

  const updateCell = (id: string, patch: Partial<NotebookCell>) => {
    const current = nbRef.current;
    persist({
      ...current,
      cells: current.cells.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const insertCellAt = (index: number): string => {
    const cells = [...nb.cells];
    const created = createCell();
    cells.splice(index, 0, created);
    persist({ ...nb, cells });
    setSelectedId(created.id);
    return created.id;
  };

  /** Returns false when the cell errored, so range runs can stop. */
  const runCell = async (id: string, sourceOverride?: string): Promise<boolean> => {
    const cell = nbRef.current.cells.find((c) => c.id === id);
    if (!cell) return false;
    const source = sourceOverride ?? cell.source;
    updateCell(id, { source, status: "running", output: "", displays: undefined });
    let result: RunResult;
    try {
      result = await run(source, "cell", { cellId: id });
    } catch (error) {
      // A bootstrap/transport failure may reject before the kernel can turn it
      // into a RunResult. Always settle the per-cell state so its spinner
      // cannot remain stuck indefinitely.
      const message = error instanceof Error ? error.message : String(error);
      result = { ok: false, stdout: "", stderr: message, error: message };
    }
    // Streams only — rich mime goes into displays (Jupyter execute_result).
    const out = formatOutputParts([
      result.stdout,
      result.stderr,
      result.error,
    ]);
    const displays: MimeBundle[] = [];
    if (result.displays?.length) displays.push(...result.displays);
    if (result.data) displays.push(result.data);
    // Commit through nbRef synchronously before resolving runCell. Range runs
    // start the next cell immediately; a queued setState callback could run
    // after that next cell was marked running and overwrite the prior cell
    // with a stale `running` snapshot.
    const current = nbRef.current;
    const nextExec = result.ok ? current.nextExec + 1 : current.nextExec;
    const next: NotebookState = {
      nextExec,
      cells: current.cells.map((c) =>
        c.id === id
          ? {
              ...c,
              status: result.interrupted ? "idle" : result.ok ? "ok" : "error",
              output: out || (result.ok ? "" : (result.error ?? "")),
              displays: displays.length ? displays : undefined,
              execCount: result.ok ? current.nextExec : c.execCount,
            }
          : c,
      ),
    };
    persist(next);
    return result.ok;
  };

  /** Run a contiguous range, stopping at the first failure. */
  const runFrom = async (startIndex: number) => {
    for (const cell of nb.cells.slice(Math.max(0, startIndex))) {
      const result = await runCell(cell.id);
      if (result === false) return;
    }
  };

  const runAll = () => runFrom(0);

  const selectedIndex = nb.cells.findIndex((c) => c.id === selectedId);
  const hasSelection = selectedIndex >= 0;

  const starting = status === "loading";
  const running = status === "busy";
  const busy = running || starting;

  /**
   * One kernel control: status icon + click action.
   * idle → start · ready/busy/error → restart · loading → wait (disabled).
   */
  const kernelIcon = running ? (
    <span style={{ color: tokens.completed, display: "inline-flex" }}>
      <IconKernelReady />
    </span>
  ) : status === "ready" ? (
    <IconKernelReady />
  ) : status === "error" ? (
    <IconKernelError />
  ) : (
    <IconKernelIdle />
  );
  const kernelLabel =
    status === "idle"
      ? "Start kernel"
      : status === "error"
        ? "Kernel failed — click to restart"
        : starting
          ? "Starting kernel…"
          : running
            ? "Kernel busy — click to restart"
            : "Kernel ready — click to restart";

  const onKernelClick = () => {
    if (status === "loading") return;
    if (status === "idle") {
      void start();
      return;
    }
    // ready / busy / error: tear down and boot again
    void reset();
  };

  useEffect(() => {
    ensureSpinKeyframes();
  }, []);

  // Monaco is part of the Python-tab runtime, not an on-demand detail of a
  // double-click. Start loading as soon as the tab mounts and surface failure.
  useEffect(() => {
    let current = true;
    void loadMonaco().catch((error: unknown) => {
      if (!current) return;
      const message = error instanceof Error ? error.message : String(error);
      setMonacoError(`Monaco failed to load: ${message}`);
    });
    return () => { current = false; };
  }, []);

  return (
    <div
      style={css.root}
      tabIndex={0}
      onKeyDown={(event) => {
        if (editingId || !selectedId) return;
        const index = nb.cells.findIndex((cell) => cell.id === selectedId);
        if (index < 0) return;
        const key = event.key;
        if (event.altKey && key.toLowerCase() === "z") {
          event.preventDefault();
          toggleWordWrap();
        } else if (key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          setEditingId(selectedId);
        } else if (key === "ArrowUp" || key === "ArrowDown") {
          event.preventDefault();
          const delta = key === "ArrowUp" ? -1 : 1;
          setSelectedId(nb.cells[Math.max(0, Math.min(nb.cells.length - 1, index + delta))].id);
        } else if (!event.ctrlKey && !event.metaKey && key.toLowerCase() === "a") {
          event.preventDefault();
          insertCellAt(index);
        } else if (!event.ctrlKey && !event.metaKey && key.toLowerCase() === "b") {
          event.preventDefault();
          insertCellAt(index + 1);
        } else if (!event.ctrlKey && !event.metaKey && key.toLowerCase() === "d") {
          const now = Date.now();
          if (now - deleteKeyAt.current < 500) {
            event.preventDefault();
            const remaining = nb.cells.filter((cell) => cell.id !== selectedId);
            const cells = remaining.length ? remaining : [createCell()];
            persist({ ...nb, cells });
            setSelectedId(cells[Math.min(index, cells.length - 1)].id);
            deleteKeyAt.current = 0;
          } else {
            deleteKeyAt.current = now;
          }
        } else if (event.shiftKey && key === "Enter") {
          event.preventDefault();
          void runCell(selectedId).then(() => {
            const next = nb.cells[index + 1] ?? nb.cells[index];
            setSelectedId(next.id);
          });
        } else if ((event.ctrlKey || event.metaKey) && key === "Enter") {
          event.preventDefault();
          void runCell(selectedId);
        }
      }}
    >
      <div style={css.toolbar} role="toolbar" aria-label="Notebook">
        {/* Run all is the primary/first notebook action. */}
        <IconButton
          label="Run all cells"
          accent
          disabled={busy || nb.cells.length === 0}
          onClick={() => void runAll()}
        >
          <IconPlayAll />
        </IconButton>
        <IconButton
          label="Run selected cell"
          disabled={busy || !hasSelection}
          onClick={() => {
            if (hasSelection) void runCell(nb.cells[selectedIndex].id);
          }}
        >
          {running ? <IconSpinner /> : <IconPlay />}
        </IconButton>
        <IconButton
          label="Run selected cell and everything below"
          disabled={busy || !hasSelection}
          onClick={() => void runFrom(selectedIndex)}
        >
          <IconPlayBelow />
        </IconButton>
        <IconButton
          label="Interrupt execution"
          danger
          // Allow stop while busy; also when ready so non-blocking camera
          // orbits (duration=inf) started by a finished cell can be halted.
          disabled={status === "idle" || status === "loading" || status === "error"}
          onClick={interrupt}
        >
          <IconStop />
        </IconButton>
        <IconButton
          label="Export notebook (.ipynb)"
          onClick={() => downloadNotebookIpynb(nbRef.current)}
        >
          <IconDownload />
        </IconButton>

        <span style={css.toolbarSpacer} />
        <span style={css.toolbarDivider} aria-hidden="true" />

        {/* Single kernel button: start or restart; icon is the live status. */}
        <IconButton
          label={kernelLabel}
          accent={status === "ready" || status === "busy"}
          danger={status === "error"}
          disabled={starting}
          onClick={onKernelClick}
        >
          {kernelIcon}
        </IconButton>
      </div>

      {monacoError ? (
        <div role="alert" style={css.editorError}>{monacoError}</div>
      ) : null}

      <div style={css.cells}>
        <InsertGap onInsert={() => insertCellAt(0)} />
        {nb.cells.map((cell, index) => (
          <div key={cell.id}>
            <CellRow
              cell={cell}
              busy={busy}
              selected={cell.id === selectedId}
              editing={cell.id === editingId}
              wordWrap={editorSettings.wordWrap}
              onSelect={() => {
                if (editingId && editingId !== cell.id) setEditingId(null);
                setSelectedId(cell.id);
              }}
              onEdit={() => {
                setSelectedId(cell.id);
                setEditingId(cell.id);
              }}
              onLeaveEdit={() => setEditingId(null)}
              onToggleWordWrap={toggleWordWrap}
              onChange={(source) => updateCell(cell.id, { source })}
              onRun={(source) => void runCell(cell.id, source)}
              onRunAndAdvance={(source) => {
                void runCell(cell.id, source).then(() => {
                  setEditingId(null);
                  setSelectedId(nb.cells[index + 1]?.id ?? cell.id);
                });
              }}
              onRunAndInsert={(source) => {
                void runCell(cell.id, source).then(() => {
                  const id = insertCellAt(index + 1);
                  setEditingId(id);
                });
              }}
              onDelete={() =>
                persist({
                  ...nb,
                  cells: nb.cells.filter((c) => c.id !== cell.id).length
                    ? nb.cells.filter((c) => c.id !== cell.id)
                    : [createCell()],
                })
              }
            />
            <InsertGap onInsert={() => insertCellAt(index + 1)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Thin hover target between cells — shows a minimal + to insert. */
function InsertGap({ onInsert }: { onInsert: () => void }) {
  const [hot, setHot] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Insert cell"
      style={css.insertGap}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onFocus={() => setHot(true)}
      onBlur={() => setHot(false)}
      onClick={(e) => {
        e.preventDefault();
        onInsert();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInsert();
        }
      }}
    >
      <span style={css.insertGapLine(hot)} />
      <span style={css.insertGapBtn(hot)} aria-hidden>
        +
      </span>
    </div>
  );
}

function CellRow({
  cell,
  busy,
  selected,
  editing,
  wordWrap,
  onSelect,
  onEdit,
  onLeaveEdit,
  onToggleWordWrap,
  onChange,
  onRun,
  onRunAndAdvance,
  onRunAndInsert,
  onDelete,
}: {
  cell: NotebookCell;
  busy: boolean;
  selected: boolean;
  editing: boolean;
  wordWrap: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onLeaveEdit: () => void;
  onToggleWordWrap: () => void;
  onChange: (source: string) => void;
  onRun: (source: string) => void;
  onRunAndAdvance: (source: string) => void;
  onRunAndInsert: (source: string) => void;
  onDelete: () => void;
}) {
  const running = cell.status === "running";

  return (
    // Selection follows focus as well as clicks: tabbing into a cell's
    // editor is the same intent as clicking it, and the toolbar's run
    // buttons should target what the caret is in.
    // biome-ignore lint/a11y/noStaticElementInteractions: selection mirrors focus; the textarea inside is the real control.
    <div
      tabIndex={-1}
      style={{
        ...css.cell,
        ...(selected ? css.cellSelected : null),
        ...(running ? css.cellRunning : null),
      }}
      onFocusCapture={onSelect}
      onMouseDown={(event) => {
        onSelect();
        // Monaco owns focus, selection and pointer gestures while a cell is
        // editing. Focusing the row here steals focus back immediately after
        // Monaco places its caret, leaving a visible editor with no cursor.
        if (editing) return;
        if (
          !(event.target as HTMLElement).closest(
            "button,[data-cell-selectable],.monaco-editor,textarea,input,[contenteditable=true]",
          )
        ) {
          event.currentTarget.focus();
        }
      }}
    >
      <div style={css.gutter}>
        <span style={css.prompt}>[{cell.execCount ?? " "}]</span>
        {running ? (
          <span
            style={{ ...css.iconBtn({ accent: true }), cursor: "default" }}
            title="Running…"
            aria-label="Running"
          >
            <IconSpinner />
          </span>
        ) : cell.status === "ok" ? (
          <IconButton
            label="Completed — run again"
            disabled={busy}
            onClick={() => onRun(cell.source)}
          >
            <span style={{ color: tokens.completed, display: "inline-flex" }}>
              <IconCheck />
            </span>
          </IconButton>
        ) : cell.status === "error" ? (
          <span
            style={{ ...css.iconBtn({ danger: true }), cursor: "default" }}
            title="Failed"
            aria-label="Failed"
          >
            <IconX />
          </span>
        ) : (
          <IconButton
            label="Run (Mod+Enter)"
            accent
            disabled={busy}
            onClick={() => onRun(cell.source)}
          >
            <IconPlay />
          </IconButton>
        )}
        <IconButton label="Delete cell" danger onClick={onDelete}>
          <IconTrash />
        </IconButton>
      </div>
      <div style={css.cellMain}>
        {editing ? (
          <MonacoCellEditor
            cellId={cell.id}
            source={cell.source}
            wordWrap={wordWrap}
            onChange={onChange}
            onRun={onRun}
            onRunAndAdvance={onRunAndAdvance}
            onRunAndInsert={onRunAndInsert}
            onLeaveEditMode={onLeaveEdit}
            onToggleWordWrap={onToggleWordWrap}
          />
        ) : (
          <ShikiCodeView
            source={cell.source}
            wordWrap={wordWrap}
            onClick={() => {
              if (selected) onEdit();
            }}
            onDoubleClick={onEdit}
          />
        )}
        {cell.output ? (
          <div
            data-cell-selectable="true"
            tabIndex={0}
            style={{
              ...css.out,
              ...(cell.status === "error" ? css.outError : null),
            }}
            onKeyDown={selectCurrentOutput}
          >
            {cell.output}
          </div>
        ) : null}
        {cell.displays?.map((bundle, i) => (
          <MimeOutput key={`d-${i}`} data={bundle} />
        ))}
      </div>
    </div>
  );
}

/**
 * Render one Jupyter mimebundle with IPython MIME priority.
 * HTML/SVG go through the DOM; images use data URLs; else text/plain.
 */
function MimeOutput({ data }: { data: MimeBundle }) {
  const mime = preferredMime(data);
  if (!mime) return null;
  const payload = String(data[mime] ?? "");

  if (isHtmlishMime(mime)) {
    return (
      <div
        style={css.outRich}
        // Jupyter protocol: objects publish trusted HTML via _repr_html_ /
        // _repr_mimebundle_. Same surface as notebook frontends.
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Jupyter mimebundle HTML
        dangerouslySetInnerHTML={{ __html: payload }}
      />
    );
  }

  if (isImageMime(mime)) {
    const src = payload.startsWith("data:")
      ? payload
      : `data:${mime};base64,${payload}`;
    return (
      <div style={css.outRich}>
        <img src={src} alt="" style={css.outImage} />
      </div>
    );
  }

  if (mime === "application/json") {
    let text = payload;
    try {
      text = JSON.stringify(JSON.parse(payload), null, 2);
    } catch {
      /* keep raw */
    }
    text = formatOutputText(text);
    return (
      <pre
        data-cell-selectable="true"
        tabIndex={0}
        style={css.out}
        onKeyDown={selectCurrentOutput}
      >
        {text}
      </pre>
    );
  }

  // text/plain, text/markdown, text/latex, application/javascript, …
  return (
    <pre
      data-cell-selectable="true"
      tabIndex={0}
      style={css.out}
      onKeyDown={selectCurrentOutput}
    >
      {formatOutputText(payload)}
    </pre>
  );
}

function selectCurrentOutput(event: React.KeyboardEvent<HTMLElement>): void {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "a") {
    return;
  }
  event.preventDefault();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(event.currentTarget);
  selection?.removeAllRanges();
  selection?.addRange(range);
}
