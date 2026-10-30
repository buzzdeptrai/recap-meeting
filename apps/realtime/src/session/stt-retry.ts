import type { ErrorCode } from "@recap/core";
import type { SttStatus } from "@recap/stt";

/** Minimum gap between two retry attempts (a click storm must not hammer the vendor). */
export const STT_RETRY_MIN_INTERVAL_MS = 3_000;
/** Retries a single session may start; the browser is told RATE_LIMITED after that. */
export const STT_RETRY_MAX_ATTEMPTS = 20;

export interface SttRetryOptions {
  minIntervalMs?: number;
  maxAttempts?: number;
  now?: () => number;
}

/** What the retry needs from the session; keeps this file free of session internals. */
export interface SttRetryHost {
  isLive(): boolean;
  status(): SttStatus;
  /** Reconnects the provider (the same `SttProvider.open()` used at session start). */
  open(): Promise<void>;
  refuse(code: ErrorCode, message: string): void;
  /** The attempt ended without a connection: tell the client the provider is closed again. */
  failed(): void;
  /** Frames that arrived while the attempt was in flight and did reach the vendor. */
  meterFrames(count: number): void;
}

const log = (message: string, error?: unknown) =>
  console.error(`[stt-retry] ${message}`, error instanceof Error ? error.name : "");

/**
 * Manual restart of a provider that gave up reconnecting. Idempotent: only acts while the session
 * is live, the provider is `closed` and no attempt is already running. Frames sent while the
 * attempt is connecting are buffered by the provider; they are metered only if it connects.
 */
export class SttRetry {
  private attempts = 0;
  private lastStartedAt = Number.NEGATIVE_INFINITY;
  private running = false;
  private pendingFrames = 0;
  private readonly minIntervalMs: number;
  private readonly maxAttempts: number;
  private readonly now: () => number;

  constructor(
    private readonly host: SttRetryHost,
    options: SttRetryOptions = {},
  ) {
    this.minIntervalMs = options.minIntervalMs ?? STT_RETRY_MIN_INTERVAL_MS;
    this.maxAttempts = options.maxAttempts ?? STT_RETRY_MAX_ATTEMPTS;
    this.now = options.now ?? Date.now;
  }

  /** True while an attempt is in flight: the audio path must not meter frames itself. */
  get isRunning(): boolean {
    return this.running;
  }

  countFrame(): void {
    this.pendingFrames += 1;
  }

  request(): void {
    if (!this.host.isLive()) return this.host.refuse("NOT_RECORDING", "No live recording");
    if (this.running || this.host.status() !== "closed") {
      return this.host.refuse("STT_ALREADY_OPEN", "Speech recognition is already connecting");
    }
    const at = this.now();
    if (this.attempts >= this.maxAttempts || at - this.lastStartedAt < this.minIntervalMs) {
      return this.host.refuse("RATE_LIMITED", "Too many retries; try again in a few seconds");
    }
    this.attempts += 1;
    this.lastStartedAt = at;
    this.run().catch((error: unknown) => log("retry bookkeeping failed", error));
  }

  private async run(): Promise<void> {
    this.running = true;
    this.pendingFrames = 0;
    let connected = false;
    try {
      await this.host.open();
      connected = true;
    } catch (error) {
      log("restart failed", error);
    }
    this.running = false;
    const frames = this.pendingFrames;
    this.pendingFrames = 0;
    if (!this.host.isLive()) return;
    if (connected) this.host.meterFrames(frames);
    else this.host.failed();
  }
}
