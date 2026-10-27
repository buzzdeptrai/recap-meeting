import type { Channel } from "@recap/core";
import type { GhostLineFilter } from "../ghost-filter";
import type { SttResult } from "../types";
import { systemClock, type Clock } from "./clock";
import { DEFAULT_SEGMENTER_CONFIG, type SegmenterConfig } from "./config";
import { UtteranceCursor, type EmittedTail } from "./cursor";
import { createVariantCorrector, type VariantSource } from "./correct";
import type { CutReason } from "./cut-reason";
import {
  decideCut,
  endsOnDependentWord,
  endsSentence,
  exceedsSafetyCap,
  sentencePrefixLength,
} from "./decide";
import { tokenize } from "./rules";
import type { HeldText, PendingInterim } from "./pending-types";
import { splitLongText } from "./split";
import { proportionalRanges, tokenTimeRange, type TimeRange } from "./timing";

export type { CutReason };

/** A finished transcript chunk, before `seq`/persistence are assigned. */
export interface RawSegment extends TimeRange {
  channel: Channel;
  text: string;
  lang: string | null;
  reason: CutReason;
}

export interface SegmenterOptions {
  channel: Channel;
  onSegment: (segment: RawSegment) => void;
  /** Live (not yet final) text for display, including any held short final. */
  onInterim?: (text: string, range: TimeRange) => void;
  config?: Partial<SegmenterConfig>;
  clock?: Clock;
  variants?: VariantSource;
  /** Drops hallucinated one-syllable lines; shared by both channels of a session. */
  ghostFilter?: GhostLineFilter;
}

const joinText = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(" ");

/**
 * Per-channel chunker. Feeds on interim/final STT results and emits segments cut by silence,
 * semantic boundary, hard cap or finalisation (port of translation-ai stt-processor + chunker).
 */
export class Segmenter {
  private readonly config: SegmenterConfig;
  private readonly clock: Clock;
  private readonly correct: (text: string) => string;
  /** Which leading words of the current utterance are already emitted (see cursor.ts). */
  private readonly cursor: UtteranceCursor;
  private lastEmitted: EmittedTail | null = null;
  private held: HeldText | null = null;
  private pending: PendingInterim | null = null;
  private silenceTimer: unknown = null;
  private holdTimer: unknown = null;

  constructor(private readonly options: SegmenterOptions) {
    this.config = { ...DEFAULT_SEGMENTER_CONFIG, ...options.config };
    this.clock = options.clock ?? systemClock;
    this.cursor = new UtteranceCursor(this.config);
    this.correct = options.variants ? createVariantCorrector(options.variants) : (text) => text;
  }

  onInterim(result: SttResult): void {
    const tokens = tokenize(result.text);
    this.clearSilenceTimer();
    this.flushAbandonedTurn(result);
    this.syncOffset(result, tokens);
    this.pending = { result, tokens };
    if (tokens.length <= this.cursor.offset) return;
    if (this.held) this.armHoldTimer();
    this.displayInterim(result, tokens, tokens.slice(this.cursor.offset));
    this.evaluatePending();
  }

  onFinal(result: SttResult): void {
    this.clearSilenceTimer();
    this.flushAbandonedTurn(result);
    const tokens = tokenize(result.text);
    this.syncOffset(result, tokens);
    const remainder = tokens.slice(this.cursor.offset);
    const range = remainder.length
      ? tokenTimeRange(result, tokens.length, this.cursor.offset, tokens.length)
      : null;
    this.cursor.reset();
    this.pending = null;
    if (remainder.length === 0 && !this.held) return;
    const held = this.takeHeld();
    const text = joinText(held?.text, remainder.join(" "));
    const span = {
      startMs: held?.startMs ?? range?.startMs ?? result.startMs,
      endMs: range?.endMs ?? held?.endMs ?? result.endMs,
    };
    this.settleFinal(text, span, result.lang ?? held?.lang ?? null);
  }

  /** Emits everything still buffered (held short final + uncut interim words). Use on stop. */
  flush(): void {
    this.clearSilenceTimer();
    const pending = this.pending;
    if (pending && pending.tokens.length > this.cursor.offset) {
      this.cutTo(pending.tokens.length, "flush");
    }
    this.pending = null;
    this.cursor.reset();
    this.flushHeld("flush");
  }

  dispose(): void {
    this.clearSilenceTimer();
    this.clearHoldTimer();
    this.held = null;
    this.pending = null;
  }

  /** A result starting well after the pending turn: that turn never gets a final (socket replaced). Emit its tail once. */
  private flushAbandonedTurn(result: SttResult): void {
    const pending = this.pending;
    if (!pending) return;
    if (result.startMs <= pending.result.startMs + this.config.newTurnStartToleranceMs) return;
    if (pending.tokens.length > this.cursor.offset) this.cutTo(pending.tokens.length, "flush");
    this.pending = null;
    this.cursor.reset();
  }

  private syncOffset(result: SttResult, tokens: string[]): void {
    const previous = this.held
      ? { tokens: tokenize(this.held.text), endMs: this.held.endMs }
      : this.lastEmitted;
    this.cursor.sync(result, tokens, previous);
  }

  /** Applies the cut rules to the uncut interim words; a partial cut re-evaluates the rest. */
  private evaluatePending(): void {
    const pending = this.pending;
    if (!pending) return;
    const { result, tokens } = pending;
    const words = tokens.slice(this.cursor.offset);
    if (words.length === 0) return;
    const range = tokenTimeRange(result, tokens.length, this.cursor.offset, tokens.length);
    const heldMs = this.held ? this.held.endMs - this.held.startMs : 0;
    const carryWords = this.held ? tokenize(this.held.text).length : 0;
    const speechMs = range.endMs - range.startMs + heldMs;
    const decision = decideCut(words, speechMs, this.config, carryWords);
    if (decision.kind === "cut") {
      this.cutTo(this.cursor.offset + decision.end, decision.reason);
      return this.evaluatePending();
    }
    if (decision.kind === "wait")
      this.armSilenceTimer(tokens.length, decision.delayMs, decision.reason);
  }

  private armSilenceTimer(end: number, delayMs: number, reason: CutReason): void {
    this.silenceTimer = this.clock.setTimeout(() => {
      this.silenceTimer = null;
      this.cutTo(end, reason);
    }, delayMs);
  }

  /**
   * Emits finished final text. Text before the last sentence end goes out at once; the tail is held
   * when it is too short or ends on a dependent word, so it can join the next result.
   */
  private settleFinal(text: string, span: TimeRange, lang: string | null): void {
    const tokens = tokenize(text);
    // Sentences shorter than a fragment are not split off: they join the next sentence.
    const minHead = Math.max(this.config.sentenceMinWords, this.config.fragmentMinWords);
    const prefix = sentencePrefixLength(tokens, minHead);
    if (prefix > 0) {
      const head = tokens.slice(0, prefix).join(" ");
      const tail = tokens.slice(prefix).join(" ");
      const [headRange, tailRange] = proportionalRanges([head, tail], span);
      this.emitFinalText(head, headRange ?? span, lang);
      return this.settleFinal(tail, tailRange ?? span, lang);
    }
    const holdMs = this.finalHoldMs(tokens, span);
    if (holdMs !== null) return this.hold(text, span, lang, holdMs);
    this.emitFinalText(text, span, lang);
  }

  /** How long to hold a final so it can join the next result, or null to emit it now. */
  private finalHoldMs(tokens: readonly string[], span: TimeRange): number | null {
    const speechMs = span.endMs - span.startMs;
    const sentenceEnded = endsSentence(tokens[tokens.length - 1]);
    const minimum = sentenceEnded ? this.config.sentenceMinWords : this.config.minWords;
    const holdMs = this.config.finalBufferTimeoutMs;
    if (tokens.length < minimum) return holdMs;
    if (endsOnDependentWord(tokens) && !exceedsSafetyCap(tokens, speechMs, this.config)) {
      return holdMs;
    }
    const fragment =
      tokens.length < this.config.fragmentMinWords && speechMs < this.config.fragmentMaxSpeechMs;
    return fragment ? Math.min(this.config.fragmentHoldMs, holdMs) : null;
  }

  private displayInterim(result: SttResult, tokens: string[], words: string[]): void {
    if (!this.options.onInterim) return;
    const range = tokenTimeRange(result, tokens.length, this.cursor.offset, tokens.length);
    this.options.onInterim(joinText(this.held?.text, words.join(" ")), {
      startMs: this.held?.startMs ?? range.startMs,
      endMs: range.endMs,
    });
  }

  /** Cuts the pending interim words up to token index `end` (merging any held text). */
  private cutTo(end: number, reason: CutReason): void {
    const pending = this.pending;
    if (!pending) return;
    const { result, tokens } = pending;
    const range = tokenTimeRange(result, tokens.length, this.cursor.offset, end);
    const text = tokens.slice(this.cursor.offset, end).join(" ");
    this.cursor.recordCut(result, tokens, end);
    if (end >= tokens.length) this.pending = null;
    const held = this.takeHeld();
    this.emit(
      joinText(held?.text, text),
      { startMs: held?.startMs ?? range.startMs, endMs: range.endMs },
      result.lang ?? held?.lang ?? null,
      reason,
    );
  }

  private emitFinalText(text: string, span: TimeRange, lang: string | null): void {
    if (text.length <= this.config.hardMaxChars) return this.emit(text, span, lang, "final");
    const parts = splitLongText(text, this.config.hardMaxChars);
    const ranges = proportionalRanges(parts, span);
    parts.forEach((part, i) => this.emit(part, ranges[i] ?? span, lang, "final_split"));
  }

  private hold(text: string, span: TimeRange, lang: string | null, holdMs: number): void {
    this.held = { text, lang, holdMs, ...span };
    this.armHoldTimer();
    this.options.onInterim?.(text, span);
  }

  /** (Re)starts the flush countdown; live interims keep a held final waiting for its continuation. */
  private armHoldTimer(): void {
    this.clearHoldTimer();
    this.holdTimer = this.clock.setTimeout(
      () => this.flushHeld("buffer_flush"),
      this.held?.holdMs ?? this.config.finalBufferTimeoutMs,
    );
  }

  private flushHeld(reason: CutReason): void {
    const held = this.takeHeld();
    if (held) this.emit(held.text, held, held.lang, reason);
  }

  private takeHeld(): HeldText | null {
    const held = this.held;
    this.held = null;
    this.clearHoldTimer();
    return held;
  }

  private emit(text: string, range: TimeRange, lang: string | null, reason: CutReason): void {
    const corrected = this.correct(text).trim();
    if (!corrected) return;
    // One channel is a single timeline: never start before the previous segment ended.
    const startMs = Math.max(range.startMs, this.lastEmitted?.endMs ?? 0);
    const endMs = Math.max(range.endMs, startMs);
    if (
      this.options.ghostFilter?.accept(this.options.channel, corrected, startMs, endMs) === false
    ) {
      return;
    }
    this.lastEmitted = { tokens: tokenize(text), endMs };
    this.options.onSegment({
      channel: this.options.channel,
      text: corrected,
      lang,
      reason,
      startMs,
      endMs,
    });
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer === null) return;
    this.clock.clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  private clearHoldTimer(): void {
    if (this.holdTimer === null) return;
    this.clock.clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }
}
