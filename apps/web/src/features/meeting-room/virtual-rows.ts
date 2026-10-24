import type { Channel, Mark, Segment } from "@recap/core";
import type { InterimLine, TranslationView } from "./state";
import type { ViewMode } from "./segment-row";
import { rowMetrics, type Density } from "./density";
import { buildTranscriptRows, type RowEdges, type TranscriptRow } from "./topics";
import { startsTurn, type TurnPoint } from "./turns";

export type VirtualRow =
  | { type: "edge"; side: "top" | "bottom"; key: string }
  | { type: "divider"; mark: Mark; name: string; key: string }
  | { type: "conclusion"; mark: Mark; key: string }
  | { type: "segment"; segment: Segment; key: string; showHeader: boolean }
  | { type: "interim"; channel: Channel; line: InterimLine; key: string; showHeader: boolean };

export const topicRowKey = (markId: string) => `topic-${markId}`;
export const conclusionRowKey = (markId: string) => `conclusion-${markId}`;

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
    rows.push(keyedRow(row));
  }
  if (showInterim && !edges.hasNext) rows.push(...interimRows(interim));
  if (edges.hasNext) rows.push({ type: "edge", side: "bottom", key: "edge-bottom" });
  return withTurnHeaders(rows);
}

function keyedRow(row: TranscriptRow): VirtualRow {
  if (row.type === "divider") return { ...row, key: topicRowKey(row.mark.id) };
  if (row.type === "conclusion") return { ...row, key: conclusionRowKey(row.mark.id) };
  return { ...row, key: row.segment.id, showHeader: true };
}

/** Speech timing of a row, or null for rows that are not speech (edge, divider, nothing). */
function turnPoint(row: VirtualRow | undefined): TurnPoint | null {
  if (row?.type === "segment") return row.segment;
  if (row?.type === "interim") return { channel: row.channel, ...row.line };
  return null;
}

/**
 * Sets `showHeader` on every speech row: true when it opens a turn. A row after a divider, an edge
 * loader or the list start has no known predecessor, so it keeps its header (also true for the
 * first row of a loaded page window, whose real predecessor is not loaded).
 */
function withTurnHeaders(rows: VirtualRow[]): VirtualRow[] {
  return rows.map((row, index) => {
    const point = turnPoint(row);
    if (point === null || (row.type !== "segment" && row.type !== "interim")) return row;
    const showHeader = startsTurn(turnPoint(rows[index - 1]), point);
    return row.showHeader === showHeader ? row : { ...row, showHeader };
  });
}

function interimRows(interim: InterimLines): VirtualRow[] {
  return ([0, 1] as const)
    .flatMap((channel) => {
      const line = interim[channel];
      return line
        ? [{ type: "interim" as const, channel, line, key: `interim-${channel}`, showHeader: true }]
        : [];
    })
    .sort((a, b) => (a.line.startMs ?? 0) - (b.line.startMs ?? 0));
}

export const indexOfKey = (rows: VirtualRow[], key: string): number =>
  rows.findIndex((row) => row.key === key);

/** First row that is a segment with this seq (null when it is not loaded). */
export function indexOfSeq(rows: VirtualRow[], seq: number): number {
  return rows.findIndex((row) => row.type === "segment" && row.segment.seq === seq);
}

/** Row index of the next/previous segment row from `from`, skipping dividers, conclusions and edges. */
export function neighbourSegmentIndex(rows: VirtualRow[], from: number, step: 1 | -1): number {
  for (let i = from + step; i >= 0 && i < rows.length; i += step) {
    if (rows[i]?.type === "segment") return i;
  }
  return -1;
}

/* ---- height estimates (only used until a row is measured) ---- */

export const EDGE_ROW_PX = 44;
const BODY_LINE_PX = 26.4; // 16px * 1.65
const TRANSLATION_LINE_PX = 22.75; // 14px * leading-relaxed
const CHAR_PX = 8.3;
const MIN_CHARS_PER_LINE = 20;
const FALLBACK_ROW_PX = 80;
/** Below this scroller width the phone paddings apply (the `sm` breakpoint, 640px viewport). */
export const PHONE_PX = 600;

export interface EstimateContext {
  view: ViewMode;
  density: Density;
  /** Width of the scroller; defaults to a desktop value (also used during server render). */
  width: number;
  translations: Record<string, TranslationView | undefined>;
}

const linesFor = (text: string, perLine: number) => Math.max(1, Math.ceil(text.length / perLine));

/** Characters of body text per line for a scroller of this width. */
function charsPerLine(width: number, density: Density): number {
  const metrics = rowMetrics(density);
  const gutter = width < PHONE_PX ? metrics.gutterPhonePx : metrics.gutterWidePx;
  return Math.max(MIN_CHARS_PER_LINE, Math.min(metrics.maxTextPx, width - gutter) / CHAR_PX);
}

/** Height of a speech row without its text: row padding, speaker line (turn start), bubble padding. */
function frameHeight(density: Density, showHeader: boolean): number {
  const metrics = rowMetrics(density);
  return showHeader
    ? metrics.headerPadding + metrics.metaHeight + metrics.bubblePadding
    : metrics.continuationPadding + metrics.bubblePadding;
}

/** Rough pixel height of a row so the scroll bar and first paint are close to the final layout. */
export function estimateRowHeight(row: VirtualRow | undefined, ctx: EstimateContext): number {
  if (!row) return FALLBACK_ROW_PX;
  if (row.type === "edge") return EDGE_ROW_PX;
  if (row.type === "divider") return rowMetrics(ctx.density).dividerHeight;
  if (row.type === "conclusion") return rowMetrics(ctx.density).conclusionHeight;
  const perLine = charsPerLine(ctx.width, ctx.density);
  const frame = frameHeight(ctx.density, row.showHeader);
  if (row.type === "interim") return frame + BODY_LINE_PX * linesFor(row.line.text, perLine);
  const { segment } = row;
  const translation = ctx.translations[segment.id];
  const original = BODY_LINE_PX * linesFor(segment.text, perLine);
  if (ctx.view === "source" || !translation) return frame + original;
  if (ctx.view === "translation") return frame + BODY_LINE_PX * linesFor(translation.text, perLine);
  return (
    frame +
    original +
    rowMetrics(ctx.density).translationGap +
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
