export type Density = "compact" | "comfortable";

export const DEFAULT_DENSITY: Density = "compact";
export const DENSITY_STORAGE_KEY = "recap.transcript-density";

export const DENSITY_OPTIONS: ReadonlyArray<{ value: Density; label: string }> = [
  { value: "compact", label: "Gọn" },
  { value: "comfortable", label: "Thoải mái" },
];

export const isDensity = (value: unknown): value is Density =>
  value === "compact" || value === "comfortable";

/** Tailwind classes of one density (what a row looks like). */
export interface RowStyle {
  /** Outer horizontal padding of a row (and of topic dividers). */
  rowX: string;
  /** Vertical padding of a row that opens a turn / continues one. */
  headerY: string;
  continuationY: string;
  /** Grid: gutter column (icon / hover time) + text column. */
  grid: string;
  /** Text column: reading width. */
  column: string;
  /** Channel icon: size of the round badge. */
  avatar: string;
  /** Speaker line above the first bubble of a turn. */
  meta: string;
  /** Bubble padding + radius, for the first bubble of a turn / the following ones. */
  bubbleHeader: string;
  bubbleContinuation: string;
  /** Dashed (interim) bubble: padding is 1.5px smaller because of its border. */
  interimBubble: string;
  /** Translation paragraph under the source text. */
  translationGap: string;
  /** Topic divider padding. */
  divider: string;
  /** Conclusion divider: one fixed-height line (height class must match `conclusionHeight`). */
  conclusion: string;
}

/** Measured pixels the height estimate is built from (pinned in virtual-rows.test.ts). */
export interface RowMetrics {
  /** Row padding top + bottom. */
  headerPadding: number;
  continuationPadding: number;
  /** Speaker line above the bubble, margin included (0 for continuation rows). */
  metaHeight: number;
  /** Bubble padding top + bottom. */
  bubblePadding: number;
  /** Gap between source text and translation. */
  translationGap: number;
  /** Divider row height. */
  dividerHeight: number;
  /** Conclusion divider row height (one line, fixed). */
  conclusionHeight: number;
  /** Width the text column never exceeds (bubble max width minus its padding). */
  maxTextPx: number;
  /** Horizontal space around the text column: row padding + gutter + gap + bubble padding. */
  gutterWidePx: number;
  gutterPhonePx: number;
}

interface DensityDef {
  style: RowStyle;
  metrics: RowMetrics;
}

/**
 * Reading width of the compact layout: 80ch of the 14px UI font = ~757px column, ~733px of text,
 * about 85-90 Vietnamese characters per line. One notch wider than DESIGN.md's 72ch because rows
 * are left-aligned in the card instead of centred in a 840px frame.
 */
const COMPACT_COLUMN = "max-w-[80ch]";

const COMPACT: DensityDef = {
  style: {
    rowX: "px-3 sm:px-4",
    headerY: "pt-2 pb-[2px]",
    continuationY: "py-[2px]",
    grid: "grid-cols-[28px_minmax(0,1fr)] gap-x-2",
    column: COMPACT_COLUMN,
    avatar: "size-5 [&_svg]:size-3",
    meta: "mb-0.5 gap-2 leading-5",
    bubbleHeader: "rounded-[4px_12px_12px_12px] px-3 py-1.5",
    bubbleContinuation: "rounded-[4px_12px_12px_12px] px-3 py-1.5",
    interimBubble: "rounded-[4px_12px_12px_12px] px-[10.5px] py-[4.5px]",
    translationGap: "mt-0.5",
    divider: "px-3 pt-4 pb-1.5 sm:px-4",
    conclusion: "h-8 px-3 sm:px-4",
  },
  metrics: {
    headerPadding: 10,
    continuationPadding: 4,
    metaHeight: 23,
    bubblePadding: 12,
    translationGap: 2,
    dividerHeight: 52,
    conclusionHeight: 32,
    maxTextPx: 733,
    gutterWidePx: 92,
    gutterPhonePx: 84,
  },
};

/** The generous layout from before density existed (centred, 34px icon, roomy bubbles). */
const COMFORTABLE: DensityDef = {
  style: {
    rowX: "px-4 sm:px-8",
    headerY: "py-[9px]",
    continuationY: "py-[5px]",
    grid: "mx-auto max-w-[840px] grid-cols-[34px_minmax(0,1fr)] gap-x-2.5 sm:gap-x-3.5",
    column: "max-w-[74ch]",
    avatar: "size-[34px] [&_svg]:size-[18px]",
    meta: "mx-1 mb-[5px] gap-2.5",
    bubbleHeader: "px-[18px] py-3",
    bubbleContinuation: "px-[18px] py-3",
    interimBubble: "",
    translationGap: "mt-1",
    divider: "px-4 pt-5 pb-2 sm:px-8",
    conclusion: "h-10 px-4 sm:px-8",
  },
  metrics: {
    headerPadding: 18,
    continuationPadding: 10,
    metaHeight: 25.6,
    bubblePadding: 24,
    translationGap: 4,
    dividerHeight: 58,
    conclusionHeight: 40,
    maxTextPx: 664,
    gutterWidePx: 148,
    gutterPhonePx: 112,
  },
};

const DENSITIES: Record<Density, DensityDef> = { compact: COMPACT, comfortable: COMFORTABLE };

export const rowStyle = (density: Density): RowStyle => DENSITIES[density].style;
export const rowMetrics = (density: Density): RowMetrics => DENSITIES[density].metrics;
