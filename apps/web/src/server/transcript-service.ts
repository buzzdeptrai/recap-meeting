import type { Segment } from "@recap/core";
import type { StoredSegment, Translation } from "@recap/db";
import type { LocateDto, SegmentsPageDto, TranscriptSearchDto } from "@/lib/api-types";
import { getRepositories } from "./db";
import type { LocateQuery, SegmentsQuery, TranscriptSearchQuery } from "./transcript-schemas";

export function toSegment(stored: StoredSegment): Segment {
  const { id, seq, channel, lang, startMs, endMs, text } = stored;
  return { id, seq, channel, lang, startMs, endMs, text };
}

const toTranslationDto = ({ segmentId, lang, text, provider, latencyMs }: Translation) => ({
  segmentId,
  lang,
  text,
  provider,
  latencyMs,
});

/** One page of the transcript with the translations of exactly those segments. */
export function loadSegmentsPage(meetingId: string, query: SegmentsQuery): SegmentsPageDto {
  const repos = getRepositories();
  const page = repos.segments.page(meetingId, {
    from: query.from,
    limit: query.limit,
    dir: query.dir,
  });
  const first = page.segments[0];
  const last = page.segments.at(-1);
  const translations =
    first && last ? repos.translations.listBySeqRange(meetingId, first.seq, last.seq) : [];
  return {
    segments: page.segments.map(toSegment),
    translations: translations.map(toTranslationDto),
    nextCursor: page.nextCursor,
    prevCursor: page.prevCursor,
    total: page.total,
  };
}

/** Page containing a time / seq, or undefined when the meeting is unknown or has no such segment. */
export function locateSegment(meetingId: string, query: LocateQuery): LocateDto | undefined {
  const { repos, known } = lookup(meetingId);
  if (!known) return undefined;
  return repos.segments.locate(meetingId, query);
}

export function searchTranscript(
  meetingId: string,
  query: TranscriptSearchQuery,
): TranscriptSearchDto | undefined {
  const { repos, known } = lookup(meetingId);
  if (!known) return undefined;
  return repos.segments.search(meetingId, query.q, query.limit);
}

function lookup(meetingId: string) {
  const repos = getRepositories();
  return { repos, known: repos.meetings.get(meetingId) !== undefined };
}
