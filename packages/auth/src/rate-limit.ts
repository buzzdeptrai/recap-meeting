import {
  LOCKOUT_MS,
  MAX_FAILED_ATTEMPTS,
  MAX_FAILED_ATTEMPTS_PER_EMAIL,
  MAX_TRACKED_KEYS,
} from "./constants";

interface Entry {
  failures: number;
  lockedUntil: number;
  lastFailureAt: number;
}

/** In-memory login throttle: per IP+email (5 failures) and per email overall (20). Lock = 15 min. */
export class LoginRateLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly clock: () => number) {}

  private keys(ip: string, email: string): string[] {
    return [`pair:${ip}|${email}`, `email:${email}`];
  }

  private limit(key: string): number {
    return key.startsWith("pair:") ? MAX_FAILED_ATTEMPTS : MAX_FAILED_ATTEMPTS_PER_EMAIL;
  }

  /** Milliseconds left on the lock (0 = not locked). */
  lockedForMs(ip: string, email: string): number {
    const now = this.clock();
    let remaining = 0;
    for (const key of this.keys(ip, email)) {
      const entry = this.entries.get(key);
      if (entry && entry.lockedUntil > now)
        remaining = Math.max(remaining, entry.lockedUntil - now);
    }
    return remaining;
  }

  recordFailure(ip: string, email: string): void {
    const now = this.clock();
    this.prune(now);
    for (const key of this.keys(ip, email)) {
      const entry = this.entries.get(key) ?? { failures: 0, lockedUntil: 0, lastFailureAt: now };
      const stale = now - entry.lastFailureAt > LOCKOUT_MS;
      if (stale || (entry.lockedUntil !== 0 && entry.lockedUntil <= now)) {
        entry.failures = 0;
        entry.lockedUntil = 0;
      }
      entry.failures += 1;
      entry.lastFailureAt = now;
      if (entry.failures >= this.limit(key)) entry.lockedUntil = now + LOCKOUT_MS;
      this.entries.set(key, entry);
    }
  }

  /** A successful login clears the pair counter only (the per-email total keeps counting down by expiry). */
  recordSuccess(ip: string, email: string): void {
    this.entries.delete(`pair:${ip}|${email}`);
  }

  private prune(now: number): void {
    if (this.entries.size < MAX_TRACKED_KEYS) return;
    for (const [key, entry] of this.entries) {
      if (entry.lockedUntil <= now && now - entry.lastFailureAt > LOCKOUT_MS)
        this.entries.delete(key);
    }
    if (this.entries.size >= MAX_TRACKED_KEYS) this.entries.clear();
  }
}
