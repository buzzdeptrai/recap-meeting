import { formatTimestamp, type TranscriptLine } from "./transcript";

/** A user "new topic" marker; a HARD boundary in the minutes. */
export interface TopicMarker {
  atMs: number;
  label: string | null;
}

export const UNNAMED_TOPIC = "chưa đặt tên";

/** `=== CHỦ ĐỀ: <label> @mm:ss ===` — the line the model sees at the start of each topic. */
export function formatBoundary(marker: TopicMarker): string {
  const label = marker.label?.trim() || UNNAMED_TOPIC;
  return `=== CHỦ ĐỀ: ${label} @${formatTimestamp(marker.atMs)} ===`;
}

function boundaryLine(marker: TopicMarker): TranscriptLine {
  return { startMs: marker.atMs, endMs: marker.atMs, text: formatBoundary(marker), boundary: true };
}

/**
 * Inserts a boundary line before the first transcript line that starts at/after each marker
 * (same rule as the room UI). Markers after the last line go at the end.
 */
export function withTopicBoundaries(
  lines: TranscriptLine[],
  markers: TopicMarker[],
): TranscriptLine[] {
  if (markers.length === 0) return lines;
  const sorted = [...markers].sort((a, b) => a.atMs - b.atMs);
  const result: TranscriptLine[] = [];
  let next = 0;
  for (const line of lines) {
    while (next < sorted.length && line.startMs >= (sorted[next] as TopicMarker).atMs) {
      result.push(boundaryLine(sorted[next] as TopicMarker));
      next += 1;
    }
    result.push(line);
  }
  for (; next < sorted.length; next += 1) result.push(boundaryLine(sorted[next] as TopicMarker));
  return result;
}

interface TopicLike {
  title: string;
  keyPoints: { atMs: number | null }[];
  conclusion: { atMs: number | null } | null;
}

/** Earliest timestamp the topic refers to (null when it has none). */
function anchorMs(topic: TopicLike): number | null {
  const times = [...topic.keyPoints.map((k) => k.atMs), topic.conclusion?.atMs ?? null].filter(
    (t): t is number => t !== null,
  );
  return times.length > 0 ? Math.min(...times) : null;
}

/**
 * For every labelled marker, the first topic whose timestamps fall inside the marker's span
 * (up to the next marker) takes the user's label as its title. Topics the model split further
 * inside the span keep their own titles.
 */
export function applyTopicLabels<T extends TopicLike>(topics: T[], markers: TopicMarker[]): T[] {
  const sorted = [...markers].sort((a, b) => a.atMs - b.atMs);
  const renamed = new Set<number>();
  return topics.map((topic) => {
    const anchor = anchorMs(topic);
    if (anchor === null) return topic;
    const spanIndex = sorted.findLastIndex((m) => m.atMs <= anchor);
    const marker = sorted[spanIndex];
    const label = marker?.label?.trim();
    if (!label || renamed.has(spanIndex)) return topic;
    renamed.add(spanIndex);
    return { ...topic, title: label };
  });
}
