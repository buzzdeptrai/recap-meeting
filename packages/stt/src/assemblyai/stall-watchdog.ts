/**
 * Detects a hung AssemblyAI socket: open, but no message of any kind (Turn, Heartbeat, ...) for
 * `timeoutMs`. Works only because the URL asks for `session_heartbeat=true` (a Heartbeat every 5 s
 * of wall-clock time, even in silence). Deliberately not based on audio level: claps and music
 * would raise false alarms. Fires at most once per arming; `touch` re-arms, `stop` disarms.
 */
export class StallWatchdog {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly timeoutMs: number,
    private readonly onStall: () => void,
  ) {}

  get enabled(): boolean {
    return this.timeoutMs > 0;
  }

  get armed(): boolean {
    return this.timer !== null;
  }

  /** Starts (or restarts) the countdown. No-op when disabled. */
  touch(): void {
    if (!this.enabled) return;
    this.stop();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onStall();
    }, this.timeoutMs);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
