import { expect, test } from "@rstest/core";
import plugin from "./index";
import { fakePluginAPI, mapStorage } from "./types/contract_testing";
import type { PluginDialogSpec } from "./types/plugin-api";
import { COMMANDS, DIALOG_ID, PLUGIN_ID } from "./version";

test("registers the Alchemist dialog and a palette command that opens it", () => {
  let registeredName = "";
  let registeredLabel = "";
  let opensDialog: string | undefined;
  const dialogs: PluginDialogSpec[] = [];

  const api = fakePluginAPI({
    pluginId: plugin.id,
    storage: mapStorage(new Map<string, string>()),
    commands: {
      register(name, _command, options) {
        registeredName = name;
        registeredLabel = options?.toolbar?.label ?? "";
        opensDialog = options?.toolbar?.opensDialog;
      },
    },
    dialogs: {
      register(spec) {
        dialogs.push(spec);
      },
    },
  });

  plugin.activate(api);

  expect(plugin.id).toBe(PLUGIN_ID);
  expect(registeredName).toBe(COMMANDS.open);
  expect(registeredLabel).toBe("Alchemist");
  // The command points at the host-owned dialog rather than mounting its own
  // scrim + focus trap, which is what this plugin used to do.
  expect(opensDialog).toBe(DIALOG_ID);
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0].id).toBe(DIALOG_ID);
  expect(dialogs[0].size).toBe("lg");
});
