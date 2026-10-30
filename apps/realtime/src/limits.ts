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
/**
 * Default cap on simultaneous WebSocket clients: an internal tool with a handful of accounts,
 * each possibly holding a live meeting plus a spare tab. Override with REALTIME_MAX_CONNECTIONS.
 */
export const DEFAULT_MAX_CONNECTIONS = 40;

/** Server ping cadence; a socket that did not answer the previous ping by the next tick is dropped. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Slow-client protection, in bytes queued in the socket's send buffer (`bufferedAmount`).
 * Above the soft limit interim (non-final) messages are dropped; finals still go out.
 */
export const SOFT_BUFFER_BYTES = 1 * KIB * KIB;
/** Above this the client is too far behind to ever catch up: the socket is closed. */
export const HARD_BUFFER_BYTES = 8 * KIB * KIB;
/** After closing a slow client, force-terminate if the peer does not complete the handshake. */
export const SLOW_CLOSE_GRACE_MS = 5_000;

/** WebSocket close codes (RFC 6455 / IANA). */
export const CLOSE_POLICY_VIOLATION = 1008;
export const CLOSE_TRY_AGAIN_LATER = 1013;
/** Private-use code (4000-4999): the client could not keep up with the server's output. */
export const CLOSE_SLOW_CONSUMER = 4009;

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
