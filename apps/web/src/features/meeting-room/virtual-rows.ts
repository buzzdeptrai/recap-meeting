import type { Channel, Mark, Segment } from "@recap/core";
import type { InterimLine, TranslationView } from "./state";
import type { ViewMode } from "./segment-row";
import { buildTranscriptRows, type RowEdges } from "./topics";

export type VirtualRow =
  | { type: "edge"; side: "top" | "bottom"; key: string }
  | { type: "divider"; mark: Mark; name: string; key: string }
  | { type: "segment"; segment: Segment; key: string }
  | { type: "interim"; channel: Channel; line: InterimLine; key: string };

export type InterimLines = Record<Channel, InterimLine | null>;

interface BuildInput {
  segments: Segment[];
  marks: Mark[];
  edges: RowEdges;
  interim: InterimLines;
  /** Interim lines belong to the live tail only. */
  showInterim: boolean;
}

/** Flat list the virtualizer renders: edge loaders, dividers, segments, interim lines. */
export function buildVirtualRows({
  segments,
  marks,
  edges,
  interim,
  showInterim,
}: BuildInput): VirtualRow[] {
  const rows: VirtualRow[] = [];
  if (edges.hasPrev) rows.push({ type: "edge", side: "top", key: "edge-top" });
  for (const row of buildTranscriptRows(segments, marks, edges)) {
    rows.push(
      row.type === "divider"
        ? { ...row, key: `topic-${row.mark.id}` }
        : { ...row, key: row.segment.id },
    );
  }
  if (showInterim && !edges.hasNext) rows.push(...interimRows(interim));
  if (edges.hasNext) rows.push({ type: "edge", side: "bottom", key: "edge-bottom" });
  return rows;
}

function interimRows(interim: InterimLines): VirtualRow[] {
  return ([0, 1] as const)
    .flatMap((channel) => {
      const line = interim[channel];
      return line ? [{ type: "interim" as const, channel, line, key: `interim-${channel}` }] : [];
    })
    .sort((a, b) => (a.line.startMs ?? 0) - (b.line.startMs ?? 0));
}

export const indexOfKey = (rows: VirtualRow[], key: string): number =>
  rows.findIndex((row) => row.key === key);

/** First row that is a segment with this seq (null when it is not loaded). */
export function indexOfSeq(rows: VirtualRow[], seq: number): number {
  return rows.findIndex((row) => row.type === "segment" && row.segment.seq === seq);
}

/** Row index of the next/previous segment row from `from`, skipping dividers and edges. */
export function neighbourSegmentIndex(rows: VirtualRow[], from: number, step: 1 | -1): number {
  for (let i = from + step; i >= 0 && i < rows.length; i += step) {
    if (rows[i]?.type === "segment") return i;
  }
  return -1;
}

/* ---- height estimates (only used until a row is measured) ---- */

export const EDGE_ROW_PX = 44;
const DIVIDER_PX = 58; // pt-5 + pb-2 + chip 30
const FRAME_PX = 66.5; // py 18 + name/time line 25 + bubble padding 24 (measured)
const BODY_LINE_PX = 26.4; // 16px * 1.65
const TRANSLATION_LINE_PX = 22.75; // 14px * leading-relaxed
const TRANSLATION_GAP_PX = 4;
const CHAR_PX = 8.3;
/** The text column stops growing here (bubble max width minus its padding). */
const MAX_TEXT_PX = 664;
/** Horizontal space around the text column: room padding, avatar + gap, bubble padding. */
const GUTTER_WIDE_PX = 148;
const GUTTER_PHONE_PX = 112;
/** Below this scroller width the phone paddings apply (the `sm` breakpoint, 640px viewport). */
export const PHONE_PX = 600;

export interface EstimateContext {
  view: ViewMode;
  /** Width of the scroller; defaults to a desktop value (also used during server render). */
  width: number;
  translations: Record<string, TranslationView | undefined>;
}

const linesFor = (text: string, perLine: number) => Math.max(1, Math.ceil(text.length / perLine));

/** Characters of body text per line for a scroller of this width. */
const charsPerLine = (width: number): number => {
  const gutter = width < PHONE_PX ? GUTTER_PHONE_PX : GUTTER_WIDE_PX;
  return Math.max(20, Math.min(MAX_TEXT_PX, width - gutter) / CHAR_PX);
};

/** Rough pixel height of a row so the scroll bar and first paint are close to the final layout. */
export function estimateRowHeight(row: VirtualRow | undefined, ctx: EstimateContext): number {
  if (!row) return 80;
  if (row.type === "edge") return EDGE_ROW_PX;
  if (row.type === "divider") return DIVIDER_PX;
  const perLine = charsPerLine(ctx.width);
  if (row.type === "interim") return FRAME_PX + BODY_LINE_PX * linesFor(row.line.text, perLine);
  const { segment } = row;
  const translation = ctx.translations[segment.id];
  const original = BODY_LINE_PX * linesFor(segment.text, perLine);
  if (ctx.view === "source" || !translation) return FRAME_PX + original;
  if (ctx.view === "translation") {
    return FRAME_PX + BODY_LINE_PX * linesFor(translation.text, perLine);
  }
  return (
    FRAME_PX +
    original +
    TRANSLATION_GAP_PX +
    TRANSLATION_LINE_PX * linesFor(translation.text, perLine * 1.2)
  );
}

/* ---- scroll anchoring ---- */

export interface ScrollAnchor {
  key: string;
  /** Distance from the viewport top to the anchor row's top (negative = starts above). */
  offsetFromTop: number;
}

export interface PositionedRow {
  key: string;
  start: number;
  size: number;
}

/** The row to hold still while content changes around it: the first one reaching into the viewport. */
export function pickAnchor(rows: PositionedRow[], scrollTop: number): ScrollAnchor | null {
  const row = rows.find((candidate) => candidate.start + candidate.size > scrollTop);
  return row ? { key: row.key, offsetFromTop: row.start - scrollTop } : null;
}

/** Scroll offset that puts the anchor row back where it was on screen. */
export function anchoredScrollTop(anchor: ScrollAnchor, newStart: number): number {
  return Math.max(0, newStart - anchor.offsetFromTop);
}

/** Estimated start offset of row `index` (for the initial offset of a deep link). */
export function estimatedStart(rows: VirtualRow[], index: number, ctx: EstimateContext): number {
  let total = 0;
  for (let i = 0; i < index && i < rows.length; i++) total += estimateRowHeight(rows[i], ctx);
  return total;
}
