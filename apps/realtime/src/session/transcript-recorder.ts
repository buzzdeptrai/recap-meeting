import type { Mark, MarkKind, Segment } from "@recap/core";
import type { Repositories, StoredMark } from "@recap/db";
import type { RawSegment } from "@recap/stt";

/** Protocol offsets must be non-negative integers. */
export const toOffsetMs = (ms: number): number => Math.max(0, Math.round(ms));

function toProtocolMark(stored: StoredMark): Mark {
  return { id: stored.id, kind: stored.kind, atMs: stored.atMs, label: stored.label };
}

/**
 * Assigns the per-meeting monotonic `seq` and persists segments / marks.
 * `baseMs` shifts the session audio timeline onto the meeting timeline (non-zero on resume).
 */
export class TranscriptRecorder {
  private nextSeq: number;

  constructor(
    private readonly repos: Repositories,
    private readonly meetingId: string,
    private readonly baseMs: number,
  ) {
    this.nextSeq = repos.segments.nextSeq(meetingId);
  }

  /** Persists a finished chunk. Throws on DB errors; `seq` is only consumed on success. */
  commit(raw: RawSegment): Segment {
    const startMs = toOffsetMs(this.baseMs + raw.startMs);
    const endMs = Math.max(startMs, toOffsetMs(this.baseMs + raw.endMs));
    const stored = this.repos.segments.insert({
      meetingId: this.meetingId,
      seq: this.nextSeq,
      channel: raw.channel,
      lang: raw.lang,
      startMs,
      endMs,
      text: raw.text,
    });
    this.nextSeq += 1;
    return {
      id: stored.id,
      seq: stored.seq,
      channel: stored.channel,
      lang: stored.lang,
      startMs,
      endMs,
      text: stored.text,
    };
  }

  addMark(kind: MarkKind, atMs: number, label?: string): Mark {
    const stored = this.repos.marks.insert({
      meetingId: this.meetingId,
      kind,
      atMs: toOffsetMs(atMs),
      label,
    });
    return toProtocolMark(stored);
  }

  /** Renames (empty clears) a mark of this meeting; undefined when it does not exist. */
  setMarkLabel(id: string, label: string): Mark | undefined {
    const stored = this.repos.marks.updateLabel(this.meetingId, id, label);
    return stored ? toProtocolMark(stored) : undefined;
  }

  removeMark(id: string): boolean {
    return this.repos.marks.remove(this.meetingId, id);
  }

  /** Shifts a stream-relative time to the meeting timeline. */
  toMeetingMs(streamMs: number): number {
    return toOffsetMs(this.baseMs + streamMs);
  }
}
