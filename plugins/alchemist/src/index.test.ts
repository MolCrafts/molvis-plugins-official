import { expect, test } from "@rstest/core";
import plugin from "./index";
import type { PluginCommandFn, PluginAPI } from "./types/plugin-api";

test("registers the Alchemist toolbar command", () => {
  let registeredName = "";
  let registeredCommand: PluginCommandFn | null = null;
  let registeredLabel = "";
  const storage = new Map<string, string>();
  const api: PluginAPI = {
    pluginId: plugin.id,
    log: {
      info() {},
      warn() {},
      error() {},
    },
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    commands: {
      register(name, command, options) {
        registeredName = name;
        registeredCommand = command as PluginCommandFn;
        registeredLabel = options?.toolbar?.label ?? "";
      },
    },
  };

  plugin.activate(api);

  expect(plugin.id).toBe("com.molcrafts.alchemist");
  expect(registeredName).toBe("alchemist.open");
  expect(registeredLabel).toBe("Alchemist");
  expect(registeredCommand).not.toBeNull();
});
