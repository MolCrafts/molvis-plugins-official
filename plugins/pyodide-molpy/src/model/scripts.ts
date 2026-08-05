/**
 * Named script library (e.g. camera.py) for Monaco editor + ``mv.run(...)``.
 * Notebook cells are separate — they never use Monaco.
 */

export interface ScriptFile {
  /** Canonical name including ``.py``, e.g. ``camera.py``. */
  name: string;
  source: string;
  updatedAt: number;
}

export interface ScriptLibrary {
  version: 1;
  /** Active editor file name. */
  active: string;
  files: Record<string, ScriptFile>;
}

const STORAGE_KEY = "scripts.v1";
export const SCRIPTS_STORAGE_KEY = STORAGE_KEY;

export const DEFAULT_CAMERA_SCRIPT = `\
import numpy as np
import molvis as mv

stage = mv.Stage()
stage.camera.fit()
pose = stage.camera.pose
t = np.asarray(pose.target, dtype=float)
r = float(pose.radius)
keys = [
    (t[0] + r, t[1],     t[2] + 0.3 * r),
    (t[0],     t[1] + r, t[2] + 0.3 * r),
    (t[0] - r, t[1],     t[2] + 0.3 * r),
    (t[0],     t[1] - r, t[2] + 0.3 * r),
    (t[0] + r, t[1],     t[2] + 0.3 * r),
]
stage.camera.track(keys, target=tuple(t), duration=4.0, rate=1.0)
`;

export const DEFAULT_HELLO_SCRIPT = `\
# hello.py — sample script
import molvis as mv

stage = mv.Stage()
print("hello from", __name__)
print("stage:", stage.name)
print("mode:", stage.current_mode)
# Nested scripts:
# mv.run("camera.py")
`;

export function normalizeScriptName(name: string): string {
  const trimmed = name.trim().replace(/^\/+/, "");
  if (!trimmed) return "untitled.py";
  return trimmed.endsWith(".py") ? trimmed : `${trimmed}.py`;
}

export function defaultLibrary(): ScriptLibrary {
  const camera = normalizeScriptName("camera.py");
  const hello = normalizeScriptName("hello.py");
  const now = Date.now();
  return {
    version: 1,
    active: camera,
    files: {
      [camera]: {
        name: camera,
        source: DEFAULT_CAMERA_SCRIPT,
        updatedAt: now,
      },
      [hello]: {
        name: hello,
        source: DEFAULT_HELLO_SCRIPT,
        updatedAt: now,
      },
    },
  };
}

/**
 * How many scripts are actually persisted, or 0 when nothing is saved.
 * Not `loadLibrary(...).files` length — that falls back to the default
 * library, so an untouched install would report scripts the user never wrote.
 */
export function storedScriptCount(
  storage: { getItem(k: string): string | null } | null,
): number {
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as ScriptLibrary;
    return parsed.files ? Object.keys(parsed.files).length : 0;
  } catch {
    return 0;
  }
}

export function loadLibrary(
  storage: { getItem(k: string): string | null } | null,
): ScriptLibrary {
  if (!storage) return defaultLibrary();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultLibrary();
    const parsed = JSON.parse(raw) as ScriptLibrary;
    if (
      parsed?.version !== 1 ||
      !parsed.files ||
      typeof parsed.files !== "object"
    ) {
      return defaultLibrary();
    }
    const names = Object.keys(parsed.files);
    if (names.length === 0) return defaultLibrary();
    const active =
      parsed.active && parsed.files[parsed.active] ? parsed.active : names[0];
    return { version: 1, active, files: parsed.files };
  } catch {
    return defaultLibrary();
  }
}

export function saveLibrary(
  storage: { setItem(k: string, v: string): void } | null,
  lib: ScriptLibrary,
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(lib));
  } catch {
    /* quota */
  }
}

export function listScriptNames(lib: ScriptLibrary): string[] {
  return Object.keys(lib.files).sort((a, b) => a.localeCompare(b));
}

export function getScriptSource(
  lib: ScriptLibrary,
  name: string,
): string | null {
  const key = normalizeScriptName(name);
  return lib.files[key]?.source ?? null;
}

export function upsertScript(
  lib: ScriptLibrary,
  name: string,
  source: string,
): ScriptLibrary {
  const key = normalizeScriptName(name);
  return {
    ...lib,
    active: key,
    files: {
      ...lib.files,
      [key]: { name: key, source, updatedAt: Date.now() },
    },
  };
}

export function deleteScript(lib: ScriptLibrary, name: string): ScriptLibrary {
  const key = normalizeScriptName(name);
  const { [key]: _removed, ...rest } = lib.files;
  const names = Object.keys(rest);
  if (names.length === 0) {
    return defaultLibrary();
  }
  const active = lib.active === key ? names.sort()[0] : lib.active;
  return { version: 1, active, files: rest };
}

export function scriptsMap(lib: ScriptLibrary): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, file] of Object.entries(lib.files)) {
    out[name] = file.source;
  }
  return out;
}
