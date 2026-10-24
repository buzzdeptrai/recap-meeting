export interface BufferedFrame {
  /** Position of the frame on the session audio timeline (frame counter). */
  index: number;
  data: Uint8Array;
}

/** Bounded FIFO of frames held while the socket is down; the oldest are dropped on overflow. */
export class ReplayBuffer {
  private frames: BufferedFrame[] = [];

  constructor(private readonly capacity: number) {}

  get size(): number {
    return this.frames.length;
  }

  /** Timeline index of the oldest retained frame, if any. */
  get firstIndex(): number | null {
    return this.frames[0]?.index ?? null;
  }

  push(frame: BufferedFrame): void {
    this.frames.push(frame);
    if (this.frames.length > this.capacity) this.frames.shift();
  }

  /** Returns all frames in order and empties the buffer. */
  drain(): BufferedFrame[] {
    const drained = this.frames;
    this.frames = [];
    return drained;
  }

  clear(): void {
    this.frames = [];
  }
}
