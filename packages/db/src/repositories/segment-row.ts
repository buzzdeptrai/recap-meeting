import type { Channel } from "@recap/core";
import type { StoredSegment } from "../types";

export interface SegmentRow {
  id: string;
  meeting_id: string;
  seq: number;
  channel: number;
  lang: string | null;
  start_ms: number;
  end_ms: number;
  text: string;
  created_at: string;
}

export function toStoredSegment(row: SegmentRow): StoredSegment {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    seq: row.seq,
    channel: row.channel as Channel,
    lang: row.lang,
    startMs: row.start_ms,
    endMs: row.end_ms,
    text: row.text,
    createdAt: row.created_at,
  };
}
