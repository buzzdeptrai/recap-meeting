import type {
  Mark,
  MinutesContent,
  MinutesLang,
  MinutesSource,
  Segment,
  SourceLang,
  TargetLang,
} from "@recap/core";
import type {
  Meeting,
  MinutesRunKind,
  MinutesRunPhase,
  MinutesRunStatus,
  StaleReason,
} from "@recap/db";

/** Shapes returned by the REST route handlers (JSON over the wire). */
export type MeetingDto = Meeting;

/** State of one minutes language on a list row. */
export interface MinutesBadgeDto {
  source: MinutesSource;
  /** Transcript or marks changed after the minutes were generated. */
  stale: boolean;
}

/** One row of `GET /api/meetings`: the meeting plus search extras and per-meeting counters. */
export interface MeetingListItemDto extends MeetingDto {
  /** Escaped HTML excerpt with `<mark>` around matches; present only for a transcript match. */
  snippet?: string;
  /** Languages that have stored minutes (kept for older clients; see `minutes`). */
  minutesLangs: MinutesLang[];
  minutes: Partial<Record<MinutesLang, MinutesBadgeDto>>;
  /** Topic markers set in the room. */
  topicCount: number;
  /** Conclusion markers set in the room. */
  conclusionCount: number;
  /** Approximate words in the transcript (space-separated tokens). */
  wordCount: number;
  /** Label of the earliest conclusion marker, when it has one. */
  firstConclusion?: string;
  /** First non-empty agenda line. */
  agendaPreview?: string;
}

export interface MeetingListCounts {
  all: number;
  draft: number;
  live: number;
  ended: number;
}

export interface MeetingListTotals {
  meetings: number;
  durationMs: number;
  /** Meetings created since Monday 00:00 (Vietnam time). */
  thisWeek: number;
  /** Ended meetings without minutes, or with minutes that went stale. */
  needMinutes: number;
}

/** `GET /api/meetings?deleted=1`: soft-deleted meetings, most recently deleted first. */
export interface DeletedMeetingListDto {
  meetings: MeetingDto[];
  total: number;
}

export interface MeetingListDto {
  meetings: MeetingListItemDto[];
  /** All matches before limit/offset. */
  total: number;
  /** Per status under every filter except status. */
  counts: MeetingListCounts;
  /** Aggregates over the whole current result set (all filters). */
  totals: MeetingListTotals;
}

export interface TranslationDto {
  segmentId: string;
  lang: TargetLang;
  text: string;
  provider: string;
  latencyMs: number;
}

/** `GET /api/meetings/:id/segments`: ascending by seq, with only those segments' translations. */
export interface SegmentsPageDto {
  segments: Segment[];
  translations: TranslationDto[];
  /** `from` for the next forward page; null at the end of the meeting. */
  nextCursor: number | null;
  /** `from` for the next backward page; null at the start of the meeting. */
  prevCursor: number | null;
  /** Every segment of the meeting. */
  total: number;
}

/** `GET /api/meetings/:id/segments/locate`. */
export interface LocateDto {
  segmentId: string;
  seq: number;
  startMs: number;
  /** Forward cursor of a page containing the segment, roughly centred on it. */
  from: number;
}

export interface TranscriptHitDto {
  segmentId: string;
  seq: number;
  startMs: number;
  /** Escaped HTML excerpt; only `<mark>` tags are markup. */
  snippet: string;
  source: "text" | "translation";
}

/** `GET /api/meetings/:id/search`. */
export interface TranscriptSearchDto {
  hits: TranscriptHitDto[];
  truncated: boolean;
  terms: string[];
}

/** The segment a conclusion mark points at (the rail shows its text even when not loaded). */
export interface MarkAnchorDto {
  id: string;
  seq: number;
  startMs: number;
  text: string;
}

export interface TranscriptStatsDto {
  segments: number;
  words: number;
  translated: number;
}

/** Meeting, all marks, whole-meeting counters and ONE page of the transcript (never all of it). */
export interface MeetingDetailDto {
  meeting: MeetingDto;
  marks: Mark[];
  /** Conclusion mark id -> its segment. */
  markAnchors: Record<string, MarkAnchorDto>;
  stats: TranscriptStatsDto;
  page: SegmentsPageDto;
}

export interface CreateMeetingBody {
  title: string;
  sourceLang: SourceLang;
  targetLang: TargetLang;
  agenda?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

/** Stored minutes of one meeting in one language (GET/POST/PUT `/api/meetings/:id/minutes`). */
export interface MinutesDto {
  lang: MinutesLang;
  /** Set when this is a translation of the other language's minutes; null for a source version. */
  derivedFromLang: MinutesLang | null;
  content: MinutesContent;
  source: MinutesSource;
  generatedAt: string;
  updatedAt: string;
  /** True when `staleReasons` is not empty. */
  stale: boolean;
  /** Why the minutes are out of date: transcript / marks changed, older prompt, other model. */
  staleReasons: StaleReason[];
}

/** One generation run of the minutes (`POST .../minutes` starts it, `GET .../minutes/run` polls it). */
export interface MinutesRunDto {
  runId: string;
  /** `translate`: `lang` is the language being translated into. */
  kind: MinutesRunKind;
  lang: MinutesLang;
  status: MinutesRunStatus;
  phase: MinutesRunPhase | null;
  /** Chunks summarised so far. */
  done: number;
  /** Number of chunks (0 until known). */
  total: number;
  /** Short safe text, only when `status` is failed. */
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  /** While queued: runs the worker handles first (0 = next in line). Always 0 otherwise. */
  ahead: number;
}
