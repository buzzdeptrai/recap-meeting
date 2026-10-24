import { FRAME_BYTES } from "@recap/core";

const KIB = 1024;
const BINARY_FRAMES_IN_PAYLOAD = 8;

/** Largest accepted WebSocket message; real frames are FRAME_BYTES (6400) and control JSON is tiny. */
export const MAX_PAYLOAD_BYTES = Math.max(64 * KIB, FRAME_BYTES * BINARY_FRAMES_IN_PAYLOAD);

export const RATE_WINDOW_MS = 1_000;
/** Real time is 10 frames/s; 200 leaves room for fast file replay (tools) and catch-up bursts. */
export const MAX_AUDIO_FRAMES_PER_WINDOW = 200;
/** Control messages (start/mark/stop/ping) per window. */
export const MAX_CONTROL_PER_WINDOW = 30;
/** Simultaneous WebSocket clients (this is a single-user local tool). */
export const MAX_CONNECTIONS = 20;

/** WebSocket close codes (RFC 6455 / IANA). */
export const CLOSE_POLICY_VIOLATION = 1008;
export const CLOSE_TRY_AGAIN_LATER = 1013;

/** Fixed-window counter: `hit()` returns false once the window's budget is spent. */
export class RateLimiter {
  private windowStart = 0;
  private count = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = RATE_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  hit(): boolean {
    const current = this.now();
    if (current - this.windowStart >= this.windowMs) {
      this.windowStart = current;
      this.count = 0;
    }
    this.count += 1;
    return this.count <= this.limit;
  }
}
