export type PluginCommandFn<A = unknown, R = unknown> = (
  app: unknown,
  args: A,
) => R | Promise<R>;

export interface MolvisPluginModule {
  id: string;
  name?: string;
  version?: string;
  activate(api: PluginAPI): void | Promise<void>;
  deactivate?(api: PluginAPI): void | Promise<void>;
}

export interface PluginLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface PluginStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PluginAPI {
  readonly pluginId: string;
  readonly log: PluginLogger;
  readonly storage: PluginStorage;
  commands: {
    register<A = unknown, R = unknown>(
      name: string,
      command: PluginCommandFn<A, R>,
      options?: {
        toolbar?: {
          id?: string;
          label: string;
          order?: number;
          args?: unknown;
        };
      },
    ): void;
  };
}
