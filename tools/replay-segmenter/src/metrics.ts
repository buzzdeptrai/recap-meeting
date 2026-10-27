import type { Channel } from "@recap/core";
import { alignTokens, type AlignOp } from "./align-tokens";
import { countBoundaryDups } from "./boundary-dups";
import type { TokenTime } from "./tokens";
import type { EmittedSegment, HeardMessage, ReplayResult } from "./replay";

/** How far apart a repeated word may be to count as a boundary repeat / a dropped vendor repeat. */
const NEIGHBOUR_WORDS = 6;
export const TINY_CHUNK_WORDS = 5;
/** Words of a segment's tail used to find when that text was first heard. */
const LATENCY_PROBE_WORDS = 3;

export interface Metrics {
  segments: number;
  /** Words emitted twice at a segment boundary (extra emitted words that repeat a neighbour). */
  dups: number;
  /** Final-turn words that never reached an emitted segment. */
  lost: number;
  /** Final-turn words skipped on purpose: vendor repeat of the previous turn's tail. */
  droppedOverlap: number;
  /** Emitted words with no counterpart in the final text that are not repeats (e.g. 25 vs twenty five). */
  extra: number;
  latencyP50Ms: number | null;
  latencyP90Ms: number | null;
  latencySamples: number;
  tinyChunkPct: number;
  tinyChunks: number;
}

export function computeMetrics(result: ReplayResult): Metrics {
  const channels: Channel[] = [0, 1];
  const counts = { dups: 0, lost: 0, droppedOverlap: 0, extra: 0 };
  for (const ch of channels) {
    const segments = result.segments.filter((s) => s.ch === ch);
    const emitted = segments.flatMap((s) => s.tokens);
    const ops = alignTokens(emitted, result.truth[ch]);
    const found = diffWords(ops, emitted, result.truth[ch], result.truthTimes[ch]);
    counts.dups += found.dups + countBoundaryDups(segments, ops, result.truthTimes[ch]);
    counts.lost += found.lost;
    counts.droppedOverlap += found.droppedOverlap;
    counts.extra += found.extra;
  }
  const latencies = result.segments
    .map((segment) => segmentLatency(segment, result.heard))
    .filter((value): value is number => value !== null);
  const tiny = result.segments.filter((s) => s.tokens.length <= TINY_CHUNK_WORDS).length;
  return {
    segments: result.segments.length,
    ...counts,
    latencyP50Ms: percentile(latencies, 0.5),
    latencyP90Ms: percentile(latencies, 0.9),
    latencySamples: latencies.length,
    tinyChunks: tiny,
    tinyChunkPct: result.segments.length ? (tiny / result.segments.length) * 100 : 0,
  };
}

/**
 * Classifies alignment ops of emitted words vs the final text. Surplus emitted words that repeat a
 * neighbour are dups; words also in the final text are only dups via countBoundaryDups (timing).
 */
export function diffWords(
  ops: readonly AlignOp[],
  emitted: readonly string[],
  truth: readonly string[],
  times: readonly TokenTime[],
) {
  const out = { dups: 0, lost: 0, droppedOverlap: 0, extra: 0 };
  for (const op of ops) {
    if (op.type === "ins") {
      if (repeatsNeighbour(emitted, op.a)) out.dups++;
      else out.extra++;
    } else if (op.type === "del") {
      if (isReReported(truth, times, op.b)) out.droppedOverlap++;
      else out.lost++;
    }
  }
  return out;
}

function repeatsNeighbour(words: readonly string[], index: number): boolean {
  const from = Math.max(0, index - NEIGHBOUR_WORDS);
  const to = Math.min(words.length - 1, index + NEIGHBOUR_WORDS);
  for (let i = from; i <= to; i++) if (i !== index && words[i] === words[index]) return true;
  return false;
}

/** The same word at the same moment of audio appears twice in the final text: the vendor re-reported it. */
function isReReported(
  truth: readonly string[],
  times: readonly TokenTime[],
  index: number,
): boolean {
  const mine = times[index];
  if (!mine) return false;
  const from = Math.max(0, index - NEIGHBOUR_WORDS);
  const to = Math.min(truth.length - 1, index + NEIGHBOUR_WORDS);
  for (let j = from; j <= to; j++) {
    const other = times[j];
    if (j === index || truth[j] !== truth[index] || !other) continue;
    if (mine.startMs < other.endMs && other.startMs < mine.endMs) return true;
  }
  return false;
}

/** Capture ms between a segment's text first appearing in a message and its emission. */
function segmentLatency(segment: EmittedSegment, heard: readonly HeardMessage[]): number | null {
  if (segment.reason === "flush") return null;
  const probe = segment.tokens.slice(-LATENCY_PROBE_WORDS);
  if (probe.length === 0) return null;
  const messages = heard.filter((m) => m.ch === segment.ch && m.tMs <= segment.emitMs);
  let first: number | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const contains = containsRun(messages[i]!.tokens, probe);
    if (contains) first = messages[i]!.tMs;
    else if (first !== null) break;
  }
  return first === null ? null : segment.emitMs - first;
}

function containsRun(tokens: readonly string[], probe: readonly string[]): boolean {
  for (let i = 0; i + probe.length <= tokens.length; i++) {
    if (probe.every((word, k) => tokens[i + k] === word)) return true;
  }
  return false;
}

export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!;
}
