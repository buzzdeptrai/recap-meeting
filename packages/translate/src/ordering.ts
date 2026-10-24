import { TranslateInputError } from "./errors";
import { noopLogger, type Logger } from "./types";

interface MeetingState {
  /** seq -> promise that resolves once that seq is released or failed. */
  pending: Map<number, { promise: Promise<void>; settle: () => void }>;
  lastReleased: number;
}

export interface ReleaseOutcome {
  /** False when a higher seq was already released (late arrival or abandoned wait). */
  inOrder: boolean;
}

export interface Ticket {
  /** Waits (bounded) for every earlier registered seq, then claims this seq's slot. */
  release(): Promise<ReleaseOutcome>;
  /** Marks this seq as failed so later seqs never wait for it. */
  fail(): void;
}

/**
 * Per-meeting ordering gate. Callers register a seq synchronously when it enters the
 * pipeline, translate concurrently, and only `release()` in ascending seq order.
 */
export class OrderingGate {
  private readonly meetings = new Map<string, MeetingState>();

  constructor(
    private readonly waitTimeoutMs: number,
    private readonly logger: Logger = noopLogger,
  ) {}

  register(meetingId: string, seq: number): Ticket {
    const state = this.state(meetingId);
    if (state.pending.has(seq)) {
      throw new TranslateInputError(`seq ${seq} is already being translated for this meeting`);
    }
    let settle!: () => void;
    const promise = new Promise<void>((resolve) => (settle = resolve));
    state.pending.set(seq, { promise, settle });

    const finish = () => {
      state.pending.delete(seq);
      settle();
    };
    return {
      release: async () => {
        await this.waitForEarlier(meetingId, state, seq);
        const inOrder = seq > state.lastReleased;
        if (inOrder) state.lastReleased = seq;
        finish();
        return { inOrder };
      },
      fail: finish,
    };
  }

  clear(meetingId: string): void {
    const state = this.meetings.get(meetingId);
    state?.pending.forEach((p) => p.settle());
    this.meetings.delete(meetingId);
  }

  private async waitForEarlier(meetingId: string, state: MeetingState, seq: number): Promise<void> {
    const earlier = [...state.pending.entries()].filter(([s]) => s < seq).map(([, p]) => p.promise);
    if (earlier.length === 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), this.waitTimeoutMs);
    });
    const winner = await Promise.race([Promise.all(earlier).then(() => "done" as const), timedOut]);
    clearTimeout(timer);
    if (winner === "timeout") {
      this.logger.warn("ordering wait timed out; releasing out of order", { meetingId, seq });
    }
  }

  private state(meetingId: string): MeetingState {
    let s = this.meetings.get(meetingId);
    if (!s) {
      s = { pending: new Map(), lastReleased: Number.NEGATIVE_INFINITY };
      this.meetings.set(meetingId, s);
    }
    return s;
  }
}
