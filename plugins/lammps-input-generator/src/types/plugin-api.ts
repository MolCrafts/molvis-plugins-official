/**
 * MolVis page plugin contracts — domain-oriented (no free-floating `api.ui`).
 *
 * Keep aligned with molvis monorepo `page/src/plugins/types.ts`.
 */

import type { Modifier, Molvis, Overlay } from "@molcrafts/molvis-core";
import type { FC, ReactNode } from "react";

export type PluginCommandFn<A = unknown, R = unknown> = (
  app: Molvis,
  args: A,
) => R | Promise<R>;

export type PluginModeFactory = (app: Molvis) => unknown;

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  molvis?: string;
  entry: string;
  description?: string;
}

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

export type ModifierPanelComponent = FC<{
  modifier: Modifier;
  app: Molvis | null;
  onUpdate: () => void;
}>;

export interface CommandToolbarOptions {
  id?: string;
  label: string;
  icon?: ReactNode;
  order?: number;
  isVisible?: (app: Molvis) => boolean;
  args?: unknown;
  /** Open a dialog registered via `api.dialogs` (relative or namespaced id). */
  opensDialog?: string;
}

export interface ModePanelSpec {
  id: string;
  title?: string;
  order?: number;
  render: FC<{ app: Molvis | null }>;
}

export interface ModeTabSpec {
  mode: string;
  label: string;
  icon?: ReactNode;
  order?: number;
}

export type PluginDialogSize = "md" | "lg" | "xl" | "full";

export interface PluginDialogSpec {
  id: string;
  title: string;
  order?: number;
  size?: PluginDialogSize;
  render: FC<{ app: Molvis | null; close: () => void }>;
}

export type PluginPanelPosition = "bottom";

export interface PluginPanelSpec {
  id: string;
  position: PluginPanelPosition;
  title: string;
  order?: number;
  defaultOpen?: boolean;
  defaultSize?: number;
  render: FC<{ app: Molvis | null }>;
}

export interface SettingsSectionSpec {
  id: string;
  title: string;
  order?: number;
  render: FC<{ app: Molvis | null }>;
}

export type PluginAnalysisParamKind =
  | "int"
  | "float"
  | "bool"
  | "select"
  | "text";

export interface PluginAnalysisParamSpec {
  name: string;
  label: string;
  kind: PluginAnalysisParamKind;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
}

export interface PluginAnalysisContext {
  app: Molvis;
  params: Record<string, unknown>;
}

export interface PluginAnalysisResult {
  data: unknown;
}

export interface PluginAnalysisSpec {
  id: string;
  label: string;
  description?: string;
  params: PluginAnalysisParamSpec[];
  run: (
    ctx: PluginAnalysisContext,
  ) => Promise<PluginAnalysisResult> | PluginAnalysisResult;
  resultKind?: "table" | "scalar" | "custom";
  renderResult?: FC<{ result: PluginAnalysisResult }>;
}

export type PluginRpcHandler = (
  params: Record<string, unknown>,
  ctx: { app: Molvis },
) => unknown | Promise<unknown>;

/**
 * Domain-oriented plugin surface. UI is attached to each domain, not a
 * separate `api.ui` namespace.
 */
export interface PluginAPI {
  readonly app: Molvis;
  readonly pluginId: string;
  readonly log: PluginLogger;
  readonly storage: PluginStorage;

  modifiers: {
    register(
      kind: string,
      category: string,
      factory: () => Modifier,
      options?: { panel?: ModifierPanelComponent },
    ): void;
  };

  modes: {
    register(
      id: string,
      factory: PluginModeFactory,
      options?: {
        panel?: ModePanelSpec;
        tab?: Omit<ModeTabSpec, "mode">;
      },
    ): void;
    registerToolsPanel(mode: string, spec: ModePanelSpec): void;
  };

  analysis: {
    register(spec: PluginAnalysisSpec): void;
  };

  commands: {
    register<A = unknown, R = unknown>(
      name: string,
      fn: PluginCommandFn<A, R>,
      options?: { toolbar?: CommandToolbarOptions },
    ): void;
  };

  dialogs: {
    register(spec: PluginDialogSpec): void;
  };

  panels: {
    register(spec: PluginPanelSpec): void;
  };

  overlays: {
    add(overlay: Overlay): void;
  };

  settings: {
    registerSection(spec: SettingsSectionSpec): void;
  };

  rpc: {
    registerMethod(name: string, handler: PluginRpcHandler): void;
  };
}
