import type { Segment } from "@recap/core";
import type { SegmentsPageDto, TranslationDto } from "@/lib/api-types";

/** Which part of the meeting the client holds: one contiguous run of segments. */
export interface RoomWindow {
  /** `from` for the next backward page; null when the window starts at the first segment. */
  prevCursor: number | null;
  /** `from` for the next forward page; null when the window ends at the last segment. */
  nextCursor: number | null;
}

export type PageDirection = "forward" | "backward";

export const windowOf = (page: Pick<SegmentsPageDto, "prevCursor" | "nextCursor">): RoomWindow => ({
  prevCursor: page.prevCursor,
  nextCursor: page.nextCursor,
});

/** The window ends at the last segment, so live segments append to it. */
export const isAtTail = (window: RoomWindow): boolean => window.nextCursor === null;
export const isAtHead = (window: RoomWindow): boolean => window.prevCursor === null;

/**
 * Merges two seq-ordered runs, unique by seq (the incoming copy wins). Adjacent runs, the common
 * case when paging, are concatenated without sorting.
 */
export function mergeSegments(current: Segment[], incoming: Segment[]): Segment[] {
  const firstIn = incoming[0];
  const lastIn = incoming.at(-1);
  const firstCur = current[0];
  const lastCur = current.at(-1);
  if (!firstIn || !lastIn) return current;
  if (!firstCur || !lastCur) return incoming;
  if (lastCur.seq < firstIn.seq) return [...current, ...incoming];
  if (lastIn.seq < firstCur.seq) return [...incoming, ...current];
  const bySeq = new Map<number, Segment>();
  for (const segment of current) bySeq.set(segment.seq, segment);
  for (const segment of incoming) bySeq.set(segment.seq, segment);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/**
 * A page answers the request made with cursor `from`; if the window moved on meanwhile (another
 * jump replaced it, or an earlier response already advanced the cursor) the page is stale.
 */
export function isCurrentPage(
  window: RoomWindow,
  dir: PageDirection,
  from: number | null,
): boolean {
  const expected = dir === "forward" ? window.nextCursor : window.prevCursor;
  return from !== null && expected === from;
}

/** Folds a loaded page's cursor into the window (only the side it extends). */
export function extendWindow(
  window: RoomWindow,
  dir: PageDirection,
  page: Pick<SegmentsPageDto, "prevCursor" | "nextCursor">,
): RoomWindow {
  return dir === "forward"
    ? { ...window, nextCursor: page.nextCursor }
    : { ...window, prevCursor: page.prevCursor };
}

/** Adds page translations without overwriting ones that arrived live over the socket. */
export function mergeTranslations<T extends { lang: string; text: string; provider: string }>(
  current: Record<string, T>,
  incoming: TranslationDto[],
  toView: (t: TranslationDto) => T,
): Record<string, T> {
  if (incoming.length === 0) return current;
  const next = { ...current };
  for (const t of incoming) if (!(t.segmentId in next)) next[t.segmentId] = toView(t);
  return next;
}
