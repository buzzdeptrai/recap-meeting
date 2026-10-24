import { FRAME_MS } from "@recap/core";

/** Frames at or below this RMS (full scale = 1) count as silence (about -46 dBFS). */
export const SLEEP_LEVEL = 0.005;
/** A frame at or above this RMS wakes an idle channel (about -38 dBFS); higher than SLEEP_LEVEL on purpose. */
export const WAKE_LEVEL = 0.012;
/** Most recent frames kept while idle and replayed first on wake-up (1.5 s). */
export const PRE_ROLL_MS = 1_500;

export interface GateFrame {
  /** Position on the session audio timeline (frame counter). */
  index: number;
  data: Uint8Array;
}

export type GateState = "active" | "idle";
export type GateTransition = "idle" | "wake" | null;

export interface GateOutput {
  /** Frames to forward to the vendor, oldest first. Empty while idle. */
  send: GateFrame[];
  transition: GateTransition;
}

export interface SilenceGateConfig {
  /** Continuous silence before going idle. 0 or less disables the gate (everything passes). */
  idleAfterMs: number;
  preRollMs?: number;
  sleepLevel?: number;
  wakeLevel?: number;
}

/**
 * Per-channel silence gate. Pure: feed it each frame with its level, it says what to send.
 * Active -> idle after `idleAfterMs` of frames below `sleepLevel` (a louder frame resets the
 * count). Idle -> active on the first frame at or above `wakeLevel` (> sleepLevel = hysteresis),
 * releasing the pre-roll ring first so word starts are not cut. After waking, the silence count
 * starts from zero, so a channel cannot flap faster than `idleAfterMs`.
 */
export class SilenceGate {
  private current: GateState = "active";
  private silentFrames = 0;
  private ring: GateFrame[] = [];
  private readonly idleFrames: number;
  private readonly preRollFrames: number;
  private readonly sleepLevel: number;
  private readonly wakeLevel: number;

  constructor(config: SilenceGateConfig) {
    this.idleFrames = config.idleAfterMs > 0 ? Math.ceil(config.idleAfterMs / FRAME_MS) : 0;
    this.preRollFrames = Math.max(0, Math.round((config.preRollMs ?? PRE_ROLL_MS) / FRAME_MS));
    this.sleepLevel = config.sleepLevel ?? SLEEP_LEVEL;
    this.wakeLevel = config.wakeLevel ?? WAKE_LEVEL;
  }

  get state(): GateState {
    return this.current;
  }

  get enabled(): boolean {
    return this.idleFrames > 0;
  }

  /** Back to active with an empty ring (new connection / manual retry). */
  reset(): void {
    this.current = "active";
    this.silentFrames = 0;
    this.ring = [];
  }

  process(frame: GateFrame, level: number): GateOutput {
    if (!this.enabled) return { send: [frame], transition: null };
    return this.current === "active"
      ? this.whileActive(frame, level)
      : this.whileIdle(frame, level);
  }

  private whileActive(frame: GateFrame, level: number): GateOutput {
    this.silentFrames = level < this.sleepLevel ? this.silentFrames + 1 : 0;
    if (this.silentFrames < this.idleFrames) return { send: [frame], transition: null };
    this.current = "idle";
    this.remember(frame);
    return { send: [], transition: "idle" };
  }

  private whileIdle(frame: GateFrame, level: number): GateOutput {
    if (level < this.wakeLevel) {
      this.remember(frame);
      return { send: [], transition: null };
    }
    this.current = "active";
    this.silentFrames = 0;
    const send = [...this.ring, frame];
    this.ring = [];
    return { send, transition: "wake" };
  }

  private remember(frame: GateFrame): void {
    if (this.preRollFrames === 0) return;
    this.ring.push(frame);
    if (this.ring.length > this.preRollFrames) this.ring.shift();
  }
}
