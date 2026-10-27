import type { Channel } from "@recap/core";
import {
  Segmenter,
  segmenterConfigForLanguage,
  parseAssemblyAiMessage,
  type CutReason,
  type SegmenterConfig,
  type SttResult,
} from "@recap/stt";
import type { CaptureLine } from "./capture";
import { tokenize, tokenTimes, type TokenTime } from "./tokens";
import { VirtualClock } from "./virtual-clock";

/** Lets pending silence/hold timers fire after the last frame, before the final flush. */
const DRAIN_MS = 15_000;
const CHANNELS: readonly Channel[] = [0, 1];

export interface EmittedSegment {
  ch: Channel;
  text: string;
  tokens: string[];
  reason: CutReason;
  /** Virtual time (capture ms) at which the segmenter emitted it. */
  emitMs: number;
}

/** One transcript message the segmenter received (for latency lookups). */
export interface HeardMessage {
  ch: Channel;
  tMs: number;
  tokens: string[];
}

export interface ReplayResult {
  segments: EmittedSegment[];
  heard: HeardMessage[];
  /** Per channel: the words the vendor finally settled on (final turns, plus an unfinished tail). */
  truth: Record<Channel, string[]>;
  /** Audio time of every truth word, same indexing as `truth`. */
  truthTimes: Record<Channel, TokenTime[]>;
}

export interface ReplayOptions {
  language?: string;
  config?: Partial<SegmenterConfig>;
}

/** Feeds the capture through one real Segmenter per channel on a virtual clock. */
export function replayCapture(
  lines: readonly CaptureLine[],
  options: ReplayOptions = {},
): ReplayResult {
  const clock = new VirtualClock();
  const result: ReplayResult = {
    segments: [],
    heard: [],
    truth: { 0: [], 1: [] },
    truthTimes: { 0: [], 1: [] },
  };
  const config = { ...segmenterConfigForLanguage(options.language ?? "multi"), ...options.config };
  const segmenters = new Map<Channel, Segmenter>(
    CHANNELS.map((ch) => [ch, makeSegmenter(ch, config, clock, result)]),
  );
  const speechStart: Record<Channel, number> = { 0: 0, 1: 0 };
  const openTail: Record<Channel, SttResult | null> = { 0: null, 1: null };
  let lastMs = 0;
  for (const line of lines) {
    clock.advanceTo(line.tMs);
    lastMs = Math.max(lastMs, line.tMs);
    const parsed = parseAssemblyAiMessage(line.raw, line.ch, line.base, speechStart[line.ch]);
    if (parsed.kind === "speech_started") speechStart[line.ch] = parsed.timestampMs;
    if (parsed.kind !== "result") continue;
    const tokens = tokenize(parsed.result.text);
    result.heard.push({ ch: line.ch, tMs: line.tMs, tokens });
    const segmenter = segmenters.get(line.ch)!;
    if (parsed.isFinal) {
      addTruth(result, line.ch, parsed.result);
      openTail[line.ch] = null;
      segmenter.onFinal(parsed.result);
    } else {
      openTail[line.ch] = parsed.result;
      segmenter.onInterim(parsed.result);
    }
  }
  clock.advanceTo(lastMs + DRAIN_MS);
  for (const ch of CHANNELS) {
    segmenters.get(ch)!.flush();
    const tail = openTail[ch];
    if (tail) addTruth(result, ch, tail);
  }
  return result;
}

function addTruth(result: ReplayResult, ch: Channel, stt: SttResult): void {
  result.truth[ch].push(...tokenize(stt.text));
  result.truthTimes[ch].push(...tokenTimes(stt));
}

function makeSegmenter(
  ch: Channel,
  config: SegmenterConfig,
  clock: VirtualClock,
  result: ReplayResult,
): Segmenter {
  return new Segmenter({
    channel: ch,
    config,
    clock,
    onSegment: (segment) =>
      result.segments.push({
        ch,
        text: segment.text,
        tokens: tokenize(segment.text),
        reason: segment.reason,
        emitMs: clock.now,
      }),
  });
}
