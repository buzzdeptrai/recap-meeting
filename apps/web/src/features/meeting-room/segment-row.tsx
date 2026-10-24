import { Bubble } from "@recap/admin-ui";
import clsx from "clsx";
import { memo, type ReactNode } from "react";
import type { Channel, Segment, TargetLang } from "@recap/core";
import { formatClock } from "@/lib/format";
import { rowStyle, type Density } from "./density";
import {
  bubbleTone,
  ChannelAvatar,
  ChannelMeta,
  GutterTime,
  LangTag,
  Marked,
  SpokenBy,
  TypingDots,
} from "./row-parts";
import type { InterimLine, TranslationView } from "./state";

export type ViewMode = "both" | "source" | "translation";

interface RowFrameProps {
  startMs: number;
  channel: Channel;
  density: Density;
  /** Opens a turn: speaker icon + name above the bubble. Otherwise only a hover time shows. */
  showHeader: boolean;
  animate?: boolean;
  highlight?: boolean;
  id?: string;
  /** Focusable by script (arrow keys move between rows), not part of the tab order. */
  navigable?: boolean;
  children: ReactNode;
}

/**
 * Gutter (icon, or hover time) + text column. The vertical gap between rows lives in the padding:
 * a turn's first row is spaced further from the row above than its continuation rows are.
 */
function RowFrame({
  startMs,
  channel,
  density,
  showHeader,
  animate = false,
  highlight = false,
  id,
  navigable = false,
  children,
}: RowFrameProps) {
  const style = rowStyle(density);
  const time = formatClock(startMs);
  return (
    <div
      id={id}
      tabIndex={navigable ? -1 : undefined}
      data-seg-row={navigable ? "" : undefined}
      className={clsx(
        "group/row outline-none focus-visible:bg-soft-inset focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
        style.rowX,
        showHeader ? style.headerY : style.continuationY,
        highlight && "bg-soft-inset",
        animate && "animate-segment-in",
      )}
    >
      <div className={clsx("grid", style.grid)}>
        {showHeader ? (
          <>
            <ChannelAvatar channel={channel} density={density} />
            <ChannelMeta channel={channel} time={time} density={density} />
          </>
        ) : (
          <GutterTime ms={startMs} />
        )}
        <div className={clsx("col-start-2 min-w-0", style.column)}>
          {!showHeader && <SpokenBy channel={channel} time={time} />}
          {children}
        </div>
      </div>
    </div>
  );
}

interface TranslationLineProps {
  translation: TranslationView;
  view: ViewMode;
  density: Density;
  targetLang: TargetLang;
  terms: readonly string[] | undefined;
}

/** The target language is stated once (view control hint); a tag shows only for other languages. */
function TranslationLine(props: TranslationLineProps) {
  const { translation, view, density, targetLang, terms } = props;
  return (
    <p
      lang={translation.lang}
      className={clsx(
        "leading-relaxed",
        view === "translation"
          ? "text-transcript text-fg"
          : clsx(rowStyle(density).translationGap, "text-[14px] text-fg-muted"),
      )}
    >
      {translation.lang !== targetLang && <LangTag lang={translation.lang} />}
      <Marked text={translation.text} terms={terms} />
    </p>
  );
}

interface SegmentRowProps {
  segment: Segment;
  translation: TranslationView | undefined;
  view: ViewMode;
  density: Density;
  /** Language the meeting translates into. */
  targetLang: TargetLang;
  showHeader: boolean;
  animate: boolean;
  highlight?: boolean;
  /** Folded search words to mark inside the text (stable array while a search is shown). */
  terms?: readonly string[];
}

type BubbleBodyProps = Pick<
  SegmentRowProps,
  "segment" | "translation" | "view" | "density" | "targetLang" | "terms"
>;

/** Source text and/or translation, depending on the view mode. */
function BubbleBody(props: BubbleBodyProps) {
  const { segment, translation, view, density, targetLang, terms } = props;
  const translated = translation && (
    <TranslationLine
      translation={translation}
      view={view}
      density={density}
      targetLang={targetLang}
      terms={terms}
    />
  );
  if (view === "translation" && translated) return translated;
  const muted = view === "translation";
  return (
    <>
      <p className={clsx("text-transcript", muted ? "text-fg-muted" : "text-fg")}>
        <Marked text={segment.text} terms={terms} />
      </p>
      {view === "both" && translated}
    </>
  );
}

function SegmentRowBase(props: SegmentRowProps) {
  const { segment, density, showHeader, animate, highlight = false } = props;
  const style = rowStyle(density);
  return (
    <RowFrame
      id={`seg-${segment.id}`}
      startMs={segment.startMs}
      channel={segment.channel}
      density={density}
      showHeader={showHeader}
      animate={animate}
      highlight={highlight}
      navigable
    >
      <Bubble
        tone={bubbleTone(segment.channel)}
        className={showHeader ? style.bubbleHeader : style.bubbleContinuation}
      >
        <BubbleBody {...props} />
      </Bubble>
    </RowFrame>
  );
}

export const SegmentRow = memo(SegmentRowBase);

interface InterimRowProps {
  channel: Channel;
  line: InterimLine;
  density: Density;
  showHeader: boolean;
}

/** Not yet final: dashed bubble, italic text, typing dots. */
export function InterimRow({ channel, line, density, showHeader }: InterimRowProps) {
  return (
    <RowFrame startMs={line.startMs} channel={channel} density={density} showHeader={showHeader}>
      <Bubble tone="dashed" className={rowStyle(density).interimBubble}>
        <p className="text-transcript text-fg-muted italic">
          {line.text}
          <TypingDots />
        </p>
      </Bubble>
    </RowFrame>
  );
}
