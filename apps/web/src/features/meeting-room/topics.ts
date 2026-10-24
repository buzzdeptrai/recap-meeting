import type { Mark, Segment } from "@recap/core";

export const topicMarks = (marks: Mark[]): Mark[] => marks.filter((m) => m.kind === "topic");
export const conclusionMarks = (marks: Mark[]): Mark[] =>
  marks.filter((m) => m.kind === "conclusion");

/** Label, or "Chủ đề N" (N = 1-based position among topic markers by time). */
export function topicName(mark: Mark, topics: Mark[]): string {
  const label = mark.label?.trim();
  if (label) return label;
  const index = topics.findIndex((t) => t.id === mark.id);
  return `Chủ đề ${index < 0 ? topics.length + 1 : index + 1}`;
}

export type TranscriptRow =
  | { type: "divider"; mark: Mark; name: string }
  | { type: "conclusion"; mark: Mark }
  | { type: "segment"; segment: Segment };

/**
 * Topic and conclusion marks in reading order: by time, and a topic before a conclusion at the same
 * instant (the conclusion belongs to the topic that is just starting). Equal kinds keep their order.
 */
export function dividerMarks(marks: Mark[]): Mark[] {
  const rank = (mark: Mark) => (mark.kind === "topic" ? 0 : 1);
  return marks
    .filter((m) => m.kind === "topic" || m.kind === "conclusion")
    .map((mark, index) => ({ mark, index }))
    .sort((a, b) => a.mark.atMs - b.mark.atMs || rank(a.mark) - rank(b.mark) || a.index - b.index)
    .map(({ mark }) => mark);
}

function dividerRow(mark: Mark, topics: Mark[]): TranscriptRow {
  return mark.kind === "topic"
    ? { type: "divider", mark, name: topicName(mark, topics) }
    : { type: "conclusion", mark };
}

/** Which sides of the loaded run have more segments beyond them. */
export interface RowEdges {
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Transcript rows in reading order: a topic or conclusion divider sits before the first segment
 * whose `startMs >= mark.atMs` (so a conclusion lands right after the segment that spans or
 * precedes it, which is the server's mark anchor); dividers with no later segment go at the end.
 * When the run is only a window of the meeting, dividers that would sit outside it are left out:
 * their neighbouring segment is not loaded, so their position is unknown.
 */
export function buildTranscriptRows(
  segments: Segment[],
  marks: Mark[],
  edges: RowEdges = { hasPrev: false, hasNext: false },
): TranscriptRow[] {
  const topics = topicMarks(marks);
  const dividers = dividerMarks(marks);
  const rows: TranscriptRow[] = [];
  let next = 0;
  const flushUpTo = (startMs: number, visible: boolean) => {
    while (next < dividers.length && (dividers[next] as Mark).atMs <= startMs) {
      const mark = dividers[next] as Mark;
      if (visible) rows.push(dividerRow(mark, topics));
      next += 1;
    }
  };
  segments.forEach((segment, index) => {
    flushUpTo(segment.startMs, index > 0 || !edges.hasPrev);
    rows.push({ type: "segment", segment });
  });
  flushUpTo(Number.POSITIVE_INFINITY, !edges.hasNext);
  return rows;
}

/** Id of a topic marker that appeared since `knownIds` (the one the user just added), if any. */
export function findNewTopicId(knownIds: ReadonlySet<string>, marks: Mark[]): string | null {
  const fresh = topicMarks(marks).filter((m) => !knownIds.has(m.id));
  return fresh.at(-1)?.id ?? null;
}
