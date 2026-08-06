/**
 * Tracks which log lines the console has already shown.
 *
 * xterm loads from a CDN, so early lines land in the `<pre>` fallback and the
 * terminal takes over later. **A sink change means replay everything** — the
 * backlog belongs to the console, not to whichever element was mounted when
 * it arrived.
 *
 * A plain class so that rule is testable without a DOM, a CDN or a kernel.
 */

export type ConsoleSink = "pre" | "term";

export class ConsoleSinkLedger {
  private written = new Set<string>();
  private sink: ConsoleSink | null = null;

  /** Lines `sink` still has to render, in order. */
  take<T extends { id: string }>(
    logs: readonly T[],
    sink: ConsoleSink,
  ): T[] {
    if (this.sink !== sink) {
      this.sink = sink;
      this.written.clear();
    }
    const pending: T[] = [];
    for (const line of logs) {
      if (this.written.has(line.id)) continue;
      this.written.add(line.id);
      pending.push(line);
    }
    return pending;
  }

  /** Forget everything (panel cleared, or unmounted). */
  reset(): void {
    this.written.clear();
    this.sink = null;
  }
}
