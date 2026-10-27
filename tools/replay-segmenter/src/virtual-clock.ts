import type { Clock } from "@recap/stt";

interface Timer {
  id: number;
  at: number;
  callback: () => void;
}

/** Deterministic clock: timers only fire when `advanceTo` moves time past them. */
export class VirtualClock implements Clock {
  now = 0;
  private nextId = 1;
  private timers: Timer[] = [];

  setTimeout(callback: () => void, ms: number): unknown {
    const timer = { id: this.nextId++, at: this.now + ms, callback };
    this.timers.push(timer);
    return timer.id;
  }

  clearTimeout(handle: unknown): void {
    this.timers = this.timers.filter((timer) => timer.id !== handle);
  }

  /** Fires every timer due at or before `target` in time order, then sets `now = target`. */
  advanceTo(target: number): void {
    for (let timer = this.takeDue(target); timer; timer = this.takeDue(target)) {
      this.now = Math.max(this.now, timer.at);
      timer.callback();
    }
    this.now = Math.max(this.now, target);
  }

  private takeDue(target: number): Timer | undefined {
    let best: Timer | undefined;
    for (const timer of this.timers) {
      if (timer.at <= target && (!best || timer.at < best.at)) best = timer;
    }
    if (best) this.timers = this.timers.filter((timer) => timer !== best);
    return best;
  }
}
