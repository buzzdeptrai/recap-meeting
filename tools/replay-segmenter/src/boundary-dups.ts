import type { AlignOp } from "./align-tokens";
import type { EmittedSegment } from "./replay";
import type { TokenTime } from "./tokens";

const MAX_OVERLAP_WORDS = 6;

/**
 * Counts words repeated across a segment boundary that are the SAME audio re-reported by the
 * vendor. The repeat is a genuine speaker repeat ("no no no") when its second occurrence starts
 * after the first one ended; it is a dup when it starts before (same moment in the audio).
 * `ops` is the alignment of this channel's emitted words (in segment order) to its truth words.
 */
export function countBoundaryDups(
  segments: readonly EmittedSegment[],
  ops: readonly AlignOp[],
  times: readonly TokenTime[],
): number {
  const toTruth = new Map<number, number>();
  for (const op of ops) if (op.type === "match" || op.type === "sub") toTruth.set(op.a, op.b);
  let dups = 0;
  let offset = 0;
  for (let s = 0; s < segments.length; s++) {
    const current = segments[s]!;
    const previous = segments[s - 1];
    if (previous) dups += boundaryDups(previous, current, offset, toTruth, times);
    offset += current.tokens.length;
  }
  return dups;
}

function boundaryDups(
  previous: EmittedSegment,
  current: EmittedSegment,
  currentOffset: number,
  toTruth: Map<number, number>,
  times: readonly TokenTime[],
): number {
  const previousOffset = currentOffset - previous.tokens.length;
  const limit = Math.min(MAX_OVERLAP_WORDS, previous.tokens.length, current.tokens.length);
  for (let k = limit; k >= 1; k--) {
    if (!sameWords(previous.tokens.slice(-k), current.tokens.slice(0, k))) continue;
    const first = toTruth.get(previousOffset + previous.tokens.length - k);
    const second = toTruth.get(currentOffset);
    const a = first === undefined ? undefined : times[first];
    const b = second === undefined ? undefined : times[second];
    if (a && b && b.startMs < a.endMs) return k;
    return 0;
  }
  return 0;
}

const sameWords = (x: readonly string[], y: readonly string[]) =>
  x.every((word, i) => word === y[i]);
