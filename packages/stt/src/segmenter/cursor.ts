import type { SttResult } from "../types";
import { alignEmittedPrefix, joinedKey, overlapPrefixLength } from "./align";
import type { SegmenterConfig } from "./config";

/** The last emitted segment of the channel, to drop words a vendor repeats at the turn join. */
export interface EmittedTail {
  tokens: string[];
  endMs: number;
}

/**
 * Tracks how many leading words of the current STT utterance are already emitted (or dropped as a
 * repeat of the previous segment). The count is re-derived from the text on every result, because
 * vendors revise earlier words and a stored index would then duplicate, lose or shift words.
 */
export class UtteranceCursor {
  /** Words of the current hypothesis that are done (emitted or dropped). */
  offset = 0;
  private key = "";
  private cuts = 0;
  private startMs = 0;

  constructor(private readonly config: SegmenterConfig) {}

  reset(): void {
    this.offset = 0;
    this.key = "";
    this.cuts = 0;
  }

  /** Re-finds the emitted words inside this (revised) hypothesis. `previous` = text before it. */
  sync(result: SttResult, tokens: string[], previous: EmittedTail | null): void {
    if (this.cuts === 0) {
      this.offset = this.leadingOverlap(result, tokens, previous);
      return;
    }
    const aligned = alignEmittedPrefix(tokens, this.key, this.offset);
    if (aligned !== null) {
      this.offset = aligned;
      this.key = joinedKey(tokens.slice(0, aligned));
      return;
    }
    if (result.startMs > this.startMs + this.config.newTurnStartToleranceMs) {
      this.reset();
      return this.sync(result, tokens, previous);
    }
    this.offset = Math.min(this.offset, tokens.length);
  }

  /** Marks words [0, end) of the hypothesis as emitted. */
  recordCut(result: SttResult, tokens: readonly string[], end: number): void {
    if (this.cuts === 0) this.startMs = result.startMs;
    this.cuts += 1;
    this.offset = end;
    this.key = joinedKey(tokens.slice(0, end));
  }

  private leadingOverlap(
    result: SttResult,
    tokens: readonly string[],
    previous: EmittedTail | null,
  ): number {
    if (!previous) return 0;
    const firstStart = result.words[0]?.startMs ?? result.startMs;
    return overlapPrefixLength(
      previous.tokens,
      tokens,
      firstStart - previous.endMs,
      this.config.overlapMaxGapMs,
    );
  }
}
