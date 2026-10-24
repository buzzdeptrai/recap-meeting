/** Pairs of context per prompt; Vietnamese chunks are short, so more pairs keep pronouns stable. */
export const DEFAULT_CONTEXT_SIZE = 6;

export interface ContextPair {
  source: string;
  translation: string;
}

/**
 * Per-meeting buffer of the last N source+translation pairs, fed into the next prompt.
 * (translation-ai only filled this in a legacy path; here the translator always does.)
 */
export class ContextStore {
  private readonly buffers = new Map<string, ContextPair[]>();

  constructor(private readonly size: number = DEFAULT_CONTEXT_SIZE) {}

  recent(meetingId: string): readonly ContextPair[] {
    return [...(this.buffers.get(meetingId) ?? [])];
  }

  push(meetingId: string, pair: ContextPair): void {
    const buffer = this.buffers.get(meetingId) ?? [];
    buffer.push(pair);
    while (buffer.length > this.size) buffer.shift();
    this.buffers.set(meetingId, buffer);
  }

  clear(meetingId: string): void {
    this.buffers.delete(meetingId);
  }
}
