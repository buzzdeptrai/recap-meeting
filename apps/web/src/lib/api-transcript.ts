import type { LocateDto, SegmentsPageDto, TranscriptSearchDto } from "./api-types";
import { request } from "./api";

const base = (meetingId: string) => `/api/meetings/${encodeURIComponent(meetingId)}`;

export interface SegmentsPageQuery {
  /** Forward: first seq (inclusive). Backward: segments before this seq. Omit for head / tail. */
  from?: number;
  limit?: number;
  dir: "forward" | "backward";
}

export function fetchSegmentsPage(
  meetingId: string,
  query: SegmentsPageQuery,
  signal?: AbortSignal,
): Promise<SegmentsPageDto> {
  const params = new URLSearchParams({ dir: query.dir });
  if (query.from !== undefined) params.set("from", String(query.from));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  return request<SegmentsPageDto>(`${base(meetingId)}/segments?${params}`, { signal });
}

export type LocateTarget = { atMs: number; seq?: never } | { seq: number; atMs?: never };

export function locateSegment(
  meetingId: string,
  target: LocateTarget,
  limit?: number,
  signal?: AbortSignal,
): Promise<LocateDto> {
  const params = new URLSearchParams();
  if (target.seq !== undefined) params.set("seq", String(target.seq));
  else params.set("atMs", String(target.atMs));
  if (limit !== undefined) params.set("limit", String(limit));
  return request<LocateDto>(`${base(meetingId)}/segments/locate?${params}`, { signal });
}

export function searchTranscript(
  meetingId: string,
  q: string,
  signal?: AbortSignal,
): Promise<TranscriptSearchDto> {
  const params = new URLSearchParams({ q });
  return request<TranscriptSearchDto>(`${base(meetingId)}/search?${params}`, { signal });
}
