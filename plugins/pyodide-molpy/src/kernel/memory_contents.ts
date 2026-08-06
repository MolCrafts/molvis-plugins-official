/**
 * Minimal in-memory {@link Contents.IManager} for embedding
 * `@jupyterlite/pyodide-kernel` without a full JupyterLite app.
 *
 * Only the methods the kernel actually touches during init/execute are
 * implemented; everything else throws.
 */

import type { Contents } from "@jupyterlab/services";
import type { ISignal } from "@lumino/signaling";
import { Signal } from "@lumino/signaling";

type FileEntry = {
  type: "file" | "directory";
  content: string | null;
  format: Contents.FileFormat;
};

function now(): string {
  return new Date().toISOString();
}

function normalize(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "") || "";
}

export class MemoryContentsManager implements Contents.IManager {
  readonly serverSettings = {} as Contents.IManager["serverSettings"];
  private readonly _fileChanged = new Signal<this, Contents.IChangedArgs>(
    this,
  );
  get fileChanged(): ISignal<Contents.IManager, Contents.IChangedArgs> {
    return this._fileChanged as unknown as ISignal<
      Contents.IManager,
      Contents.IChangedArgs
    >;
  }

  private readonly files = new Map<string, FileEntry>();

  constructor() {
    this.files.set("", {
      type: "directory",
      content: null,
      format: "json",
    });
  }

  get isDisposed(): boolean {
    return false;
  }

  dispose(): void {
    /* no-op */
  }

  addDrive(_drive: Contents.IDrive): void {
    /* single-drive memory store */
  }

  listDrives(): Contents.IDrive[] {
    return [];
  }

  removeDrive(_name: string): void {
    /* no-op */
  }

  async get(
    path: string,
    options?: Contents.IFetchOptions,
  ): Promise<Contents.IModel> {
    const p = normalize(path);
    const entry = this.files.get(p);
    if (!entry) {
      throw Object.assign(new Error(`No such file: ${path}`), {
        response: { status: 404 },
      });
    }
    const name = p.split("/").pop() || "";
    if (entry.type === "directory") {
      const prefix = p ? `${p}/` : "";
      const children: Contents.IModel[] = [];
      if (options?.content !== false) {
        const seen = new Set<string>();
        for (const key of this.files.keys()) {
          if (!key.startsWith(prefix) || key === p) continue;
          const rest = key.slice(prefix.length);
          const childName = rest.split("/")[0];
          if (!childName || seen.has(childName)) continue;
          seen.add(childName);
          const childPath = prefix + childName;
          const child = this.files.get(childPath);
          if (!child) continue;
          children.push(this.toModel(childPath, child, false));
        }
      }
      return {
        name,
        path: p,
        type: "directory",
        writable: true,
        created: now(),
        last_modified: now(),
        mimetype: "",
        content: options?.content === false ? null : children,
        format: "json",
      };
    }
    return this.toModel(p, entry, options?.content !== false);
  }

  async getDownloadUrl(path: string): Promise<string> {
    return `memory://${normalize(path)}`;
  }

  async newUntitled(
    options: Contents.ICreateOptions = {},
  ): Promise<Contents.IModel> {
    const path = normalize(
      options.path
        ? `${options.path}/untitled${options.ext ?? ".txt"}`
        : `untitled${options.ext ?? ".txt"}`,
    );
    return this.save(path, {
      type: options.type ?? "file",
      format: "text",
      content: "",
    });
  }

  async delete(path: string): Promise<void> {
    this.files.delete(normalize(path));
  }

  async rename(oldPath: string, newPath: string): Promise<Contents.IModel> {
    const from = normalize(oldPath);
    const to = normalize(newPath);
    const entry = this.files.get(from);
    if (!entry) throw new Error(`No such file: ${oldPath}`);
    this.files.delete(from);
    this.files.set(to, entry);
    return this.toModel(to, entry, true);
  }

  async save(
    path: string,
    options: Partial<Contents.IModel> = {},
  ): Promise<Contents.IModel> {
    const p = normalize(path);
    // Ensure parent directories exist.
    const parts = p.split("/").filter(Boolean);
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts.slice(0, i + 1).join("/");
      if (!this.files.has(dir)) {
        this.files.set(dir, {
          type: "directory",
          content: null,
          format: "json",
        });
      }
    }
    const type = (options.type as "file" | "directory") ?? "file";
    const format = (options.format as Contents.FileFormat) ?? "text";
    const content =
      typeof options.content === "string"
        ? options.content
        : options.content == null
          ? ""
          : JSON.stringify(options.content);
    const entry: FileEntry = {
      type,
      content: type === "directory" ? null : content,
      format,
    };
    this.files.set(p, entry);
    return this.toModel(p, entry, true);
  }

  async copy(path: string, toDir: string): Promise<Contents.IModel> {
    const model = await this.get(path);
    const name = model.name;
    const dest = normalize(`${toDir}/${name}`);
    return this.save(dest, {
      type: model.type,
      format: model.format ?? "text",
      content: model.content as string,
    });
  }

  async createCheckpoint(
    _path: string,
  ): Promise<Contents.ICheckpointModel> {
    return { id: "0", last_modified: now() };
  }

  async listCheckpoints(
    _path: string,
  ): Promise<Contents.ICheckpointModel[]> {
    return [];
  }

  async restoreCheckpoint(_path: string, _checkpointID: string): Promise<void> {
    /* no-op */
  }

  async deleteCheckpoint(_path: string, _checkpointID: string): Promise<void> {
    /* no-op */
  }

  private toModel(
    path: string,
    entry: FileEntry,
    withContent: boolean,
  ): Contents.IModel {
    const name = path.split("/").pop() || "";
    return {
      name,
      path,
      type: entry.type,
      writable: true,
      created: now(),
      last_modified: now(),
      mimetype: entry.type === "file" ? "text/plain" : "",
      content: withContent ? entry.content : null,
      format: entry.format,
    };
  }

  // ── Drive path helpers required by Contents.IManager ─────────────

  localPath(path: string): string {
    return normalize(path);
  }

  normalize(path: string): string {
    return normalize(path);
  }

  resolvePath(root: string, path: string): string {
    if (!path) return normalize(root);
    if (path.startsWith("/")) return normalize(path);
    return normalize(`${root}/${path}`);
  }

  driveName(_path: string): string {
    return "";
  }

  getSharedModelFactory(
    _path: string,
  ): Contents.ISharedFactory | null {
    return null;
  }
}
