import { describe, expect, test } from "@rstest/core";
import { ConsoleSinkLedger } from "../src/ui/console_sink";

const line = (id: string) => ({ id });

describe("ConsoleSinkLedger", () => {
  test("returns each line once for a stable sink", () => {
    const ledger = new ConsoleSinkLedger();
    const logs = [line("a"), line("b")];

    expect(ledger.take(logs, "pre").map((l) => l.id)).toEqual(["a", "b"]);
    expect(ledger.take(logs, "pre")).toEqual([]);
  });

  test("returns only the new tail when the buffer grows", () => {
    const ledger = new ConsoleSinkLedger();
    ledger.take([line("a")], "term");
    expect(ledger.take([line("a"), line("b")], "term").map((l) => l.id)).toEqual(
      ["b"],
    );
  });

  test("replays the whole backlog when the sink changes", () => {
    // The regression: kernel boot logs land in the `<pre>` fallback, xterm
    // finishes loading, `<pre>` is hidden — and the backlog must move with
    // the sink or the panel opens empty.
    const ledger = new ConsoleSinkLedger();
    const boot = [line("a"), line("b"), line("c")];
    expect(ledger.take(boot, "pre")).toHaveLength(3);

    expect(ledger.take(boot, "term").map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  test("replays on every sink change, not just the first", () => {
    const ledger = new ConsoleSinkLedger();
    const logs = [line("a")];
    ledger.take(logs, "pre");
    ledger.take(logs, "term");
    expect(ledger.take(logs, "pre").map((l) => l.id)).toEqual(["a"]);
  });

  test("reset makes the next take replay everything", () => {
    const ledger = new ConsoleSinkLedger();
    const logs = [line("a"), line("b")];
    ledger.take(logs, "term");
    ledger.reset();
    expect(ledger.take(logs, "term")).toHaveLength(2);
  });
});
