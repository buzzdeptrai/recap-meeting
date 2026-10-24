import type { SttResult } from "../types";

export interface TimeRange {
  startMs: number;
  endMs: number;
}

/**
 * Time span of tokens [from, to) of a result. Uses word timestamps when they line up with the
 * whitespace tokens; otherwise interpolates linearly across the result's span.
 */
export function tokenTimeRange(
  result: SttResult,
  tokenCount: number,
  from: number,
  to: number,
): TimeRange {
  const first = result.words[from];
  const last = result.words[to - 1];
  if (result.words.length === tokenCount && first && last) {
    return { startMs: first.startMs, endMs: last.endMs };
  }
  const span = result.endMs - result.startMs;
  const total = Math.max(tokenCount, 1);
  return {
    startMs: Math.round(result.startMs + (span * from) / total),
    endMs: Math.round(result.startMs + (span * to) / total),
  };
}

/** Distributes [startMs, endMs] across parts proportionally to their text length. */
export function proportionalRanges(parts: string[], range: TimeRange): TimeRange[] {
  const totalChars = Math.max(
    parts.reduce((sum, part) => sum + part.length, 0),
    1,
  );
  const span = range.endMs - range.startMs;
  let consumed = 0;
  return parts.map((part) => {
    const startMs = Math.round(range.startMs + (span * consumed) / totalChars);
    consumed += part.length;
    return { startMs, endMs: Math.round(range.startMs + (span * consumed) / totalChars) };
  });
}
