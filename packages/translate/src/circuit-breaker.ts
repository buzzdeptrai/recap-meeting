import type { ProviderErrorCode } from "./errors";
import { systemClock, type Clock } from "./types";

export type BreakerState = "closed" | "open" | "half-open";

export interface BreakerConfig {
  /** Trip after this many consecutive errors. */
  consecutiveErrors: number;
  /** Rolling window for the error-rate rule. */
  windowMs: number;
  /** Trip when errors/total in the window exceeds this ratio... */
  errorRate: number;
  /** ...and the window holds at least this many calls. */
  minWindowSamples: number;
  /** Time spent open before a half-open probe is allowed. */
  cooldownMs: number;
  /** Cooldown after a QUOTA (402) error: retrying sooner is pointless. */
  quotaCooldownMs: number;
}

const SECOND_MS = 1_000;
const SIX_HOURS_MS = 6 * 60 * 60 * SECOND_MS;

export const DEFAULT_BREAKER_CONFIG: BreakerConfig = {
  consecutiveErrors: 3,
  windowMs: 10 * SECOND_MS,
  errorRate: 0.3,
  minWindowSamples: 5,
  cooldownMs: 20 * SECOND_MS,
  quotaCooldownMs: SIX_HOURS_MS,
};

interface Circuit {
  state: BreakerState;
  consecutiveErrors: number;
  events: { at: number; ok: boolean }[];
  openUntil: number;
  probeInFlight: boolean;
}

export interface BreakerSnapshot {
  state: BreakerState;
  consecutiveErrors: number;
  openUntil: number | null;
}

/** Per-provider breaker: closed -> open (cooldown) -> half-open (single probe) -> closed/open. */
export class CircuitBreaker {
  private readonly circuits = new Map<string, Circuit>();

  constructor(
    private readonly config: BreakerConfig = DEFAULT_BREAKER_CONFIG,
    private readonly clock: Clock = systemClock,
  ) {}

  /**
   * Asks permission to call `name`. Returns false while open; after the cooldown the first
   * caller becomes the half-open probe and further callers are refused until it reports.
   */
  acquire(name: string): boolean {
    const c = this.circuit(name);
    if (c.state === "closed") return true;
    if (c.state === "open") {
      if (this.clock.now() < c.openUntil) return false;
      c.state = "half-open";
    }
    if (c.probeInFlight) return false;
    c.probeInFlight = true;
    return true;
  }

  recordSuccess(name: string): void {
    const c = this.circuit(name);
    c.consecutiveErrors = 0;
    this.pushEvent(c, true);
    if (c.state === "half-open") {
      c.state = "closed";
      c.events = [];
    }
    c.probeInFlight = false;
  }

  recordFailure(name: string, code: ProviderErrorCode): void {
    const c = this.circuit(name);
    // A caller-initiated abort says nothing about provider health.
    if (code === "ABORTED") {
      c.probeInFlight = false;
      return;
    }
    c.consecutiveErrors += 1;
    this.pushEvent(c, false);
    if (code === "QUOTA") this.open(c, this.config.quotaCooldownMs);
    else if (c.state === "half-open") this.open(c, this.config.cooldownMs);
    else if (c.state === "closed" && this.shouldTrip(c)) this.open(c, this.config.cooldownMs);
    c.probeInFlight = false;
  }

  state(name: string): BreakerState {
    return this.circuit(name).state;
  }

  snapshot(): Record<string, BreakerSnapshot> {
    const out: Record<string, BreakerSnapshot> = {};
    for (const [name, c] of this.circuits) {
      out[name] = {
        state: c.state,
        consecutiveErrors: c.consecutiveErrors,
        openUntil: c.state === "open" ? c.openUntil : null,
      };
    }
    return out;
  }

  private shouldTrip(c: Circuit): boolean {
    if (c.consecutiveErrors >= this.config.consecutiveErrors) return true;
    this.pruneWindow(c);
    if (c.events.length < this.config.minWindowSamples) return false;
    const errors = c.events.filter((e) => !e.ok).length;
    return errors / c.events.length > this.config.errorRate;
  }

  private open(c: Circuit, cooldownMs: number): void {
    c.state = "open";
    c.openUntil = this.clock.now() + cooldownMs;
  }

  private pushEvent(c: Circuit, ok: boolean): void {
    c.events.push({ at: this.clock.now(), ok });
    this.pruneWindow(c);
  }

  private pruneWindow(c: Circuit): void {
    const cutoff = this.clock.now() - this.config.windowMs;
    c.events = c.events.filter((e) => e.at >= cutoff);
  }

  private circuit(name: string): Circuit {
    let c = this.circuits.get(name);
    if (!c) {
      c = { state: "closed", consecutiveErrors: 0, events: [], openUntil: 0, probeInFlight: false };
      this.circuits.set(name, c);
    }
    return c;
  }
}
