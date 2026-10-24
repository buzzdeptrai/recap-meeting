import type { ServerMessage } from "@recap/core";
import type { SentMark } from "./client";

export interface AlignmentRow {
  kind: SentMark["kind"];
  atMs: number;
  /** atMs - audio-clock truth: the error of the wall clock itself (0 with --mark-clock audio). */
  clockErrorMs: number;
  /** Nearest final segment (by distance of the mark to its span), null with no segments. */
  segment: { seq: number; startMs: number; endMs: number; text: string } | null;
  /** atMs - segment.startMs (negative = mark is before the segment starts). */
  fromStartMs: number | null;
  /** atMs - segment.endMs (positive = mark is after the segment ended). */
  fromEndMs: number | null;
}

type SegmentMessage = Extract<ServerMessage, { type: "segment" }>["segment"];

const distance = (s: SegmentMessage, atMs: number) =>
  atMs < s.startMs ? s.startMs - atMs : atMs > s.endMs ? atMs - s.endMs : 0;

/** Compares every sent marker with the final segments of the run (pure; unit-tested). */
export function alignmentRows(
  marks: readonly SentMark[],
  messages: readonly ServerMessage[],
): AlignmentRow[] {
  const segments = messages.flatMap((m) => (m.type === "segment" ? [m.segment] : []));
  return marks.map((mark) => {
    const nearest = segments.reduce<SegmentMessage | null>(
      (best, s) => (best === null || distance(s, mark.atMs) < distance(best, mark.atMs) ? s : best),
      null,
    );
    return {
      kind: mark.kind,
      atMs: mark.atMs,
      clockErrorMs: mark.atMs - mark.audioAtMs,
      segment: nearest && {
        seq: nearest.seq,
        startMs: nearest.startMs,
        endMs: nearest.endMs,
        text: nearest.text,
      },
      fromStartMs: nearest ? mark.atMs - nearest.startMs : null,
      fromEndMs: nearest ? mark.atMs - nearest.endMs : null,
    };
  });
}

export function formatAlignment(rows: readonly AlignmentRow[]): string[] {
  return rows.map((r) => {
    const seg = r.segment
      ? `seg #${r.segment.seq} [${r.segment.startMs}-${r.segment.endMs}] start${signed(r.fromStartMs)} end${signed(r.fromEndMs)} ms "${r.segment.text.slice(0, 40)}"`
      : "no segment";
    return `${r.kind} atMs=${r.atMs} wall-vs-audio${signed(r.clockErrorMs)} ms -> ${seg}`;
  });
}

const signed = (n: number | null) => (n === null ? " n/a" : ` ${n >= 0 ? "+" : ""}${n}`);
