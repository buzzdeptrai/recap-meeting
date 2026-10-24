import type { Mark, Segment } from "@recap/core";

/** Words in a transcript — used for the session stats. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** The segment a mark points at: the one spanning it, else the last one that ended before it. */
export function segmentAtMark(segments: Segment[], mark: Pick<Mark, "atMs">): Segment | undefined {
  const spanning = segments.find((s) => s.startMs <= mark.atMs && mark.atMs <= s.endMs);
  if (spanning) return spanning;
  return [...segments].reverse().find((s) => s.endMs <= mark.atMs);
}

/** Id of the segment closest in time to `atMs` (distance to its span); null with no segments. */
export function nearestSegmentId(
  segments: Pick<Segment, "id" | "startMs" | "endMs">[],
  atMs: number,
): string | null {
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const s of segments) {
    const distance = atMs < s.startMs ? s.startMs - atMs : atMs > s.endMs ? atMs - s.endMs : 0;
    if (distance < bestDistance) {
      best = s.id;
      bestDistance = distance;
    }
  }
  return best;
}

export interface MarkTarget {
  id: string;
  seq: number;
  startMs: number;
  text: string;
}

/**
 * The segment a conclusion mark points at: the server's anchor (the transcript may be only
 * partly loaded), else the loaded segments (marks created live).
 */
export function markTarget(
  mark: Mark,
  anchors: Record<string, MarkTarget | undefined>,
  segments: Segment[],
): MarkTarget | undefined {
  const anchor = anchors[mark.id];
  if (anchor) return anchor;
  const found = segmentAtMark(segments, mark);
  return found && { id: found.id, seq: found.seq, startMs: found.startMs, text: found.text };
}
