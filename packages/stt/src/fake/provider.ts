import { SttEmitter } from "../emitter";
import type { SttProvider, SttResult, SttStatus } from "../types";

export interface FakeSttOptions {
  /** When set, `open()` rejects with this message (simulates an unreachable provider). */
  failOpenWith?: string;
}

type FrameAction = (provider: FakeSttProvider) => void;

/** Scriptable in-memory provider for tests; never touches the network. */
export class FakeSttProvider extends SttEmitter implements SttProvider {
  readonly name = "fake";
  readonly frames: Uint8Array[] = [];
  opened = false;
  closed = false;
  private status: SttStatus = "closed";
  private readonly frameActions = new Map<number, FrameAction[]>();

  constructor(private readonly options: FakeSttOptions = {}) {
    super();
  }

  async open(): Promise<void> {
    if (this.options.failOpenWith) {
      this.setStatus("closed");
      throw new Error(this.options.failOpenWith);
    }
    this.opened = true;
    this.setStatus("open");
  }

  sendAudio(frame: Uint8Array): void {
    if (this.closed) return;
    this.frames.push(frame);
    const actions = this.frameActions.get(this.frames.length);
    for (const action of actions ?? []) action(this);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.setStatus("closed");
  }

  /** Runs `action` right after the n-th (1-based) audio frame has been received. */
  whenFrame(n: number, action: FrameAction): this {
    this.frameActions.set(n, [...(this.frameActions.get(n) ?? []), action]);
    return this;
  }

  emitInterim(result: SttResult): void {
    this.emit("interim", result);
  }

  emitFinal(result: SttResult): void {
    this.emit("final", result);
  }

  emitError(message: string, fatal = false): void {
    this.emit("error", { message, fatal });
  }

  setStatus(next: SttStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.emit("status", next);
  }
}

/** Builds an SttResult from text with evenly spread word timestamps. */
export function fakeResult(
  channel: 0 | 1,
  text: string,
  startMs = 0,
  endMs = startMs + 1_000,
  lang: string | null = null,
): SttResult {
  const tokens = text.split(/\s+/).filter(Boolean);
  const step = tokens.length > 0 ? (endMs - startMs) / tokens.length : 0;
  const words = tokens.map((token, i) => ({
    text: token,
    startMs: Math.round(startMs + i * step),
    endMs: Math.round(startMs + (i + 1) * step),
    confidence: 1,
  }));
  return { channel, text, startMs, endMs, words, lang };
}
