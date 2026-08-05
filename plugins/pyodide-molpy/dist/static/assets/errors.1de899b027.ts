/** Detect Jupyter / asyncio interrupt outcomes from error text. */
export function isInterruptError(message: string): boolean {
  return /CancelledError|KeyboardInterrupt|InterruptRequested|Interrupted by user|InterruptedError|Execution stopped|abort/i.test(
    message,
  );
}
