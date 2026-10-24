import { Bubble } from "@recap/admin-ui";
import clsx from "clsx";
import { memo, type ReactNode } from "react";
import type { Channel, Segment } from "@recap/core";
import { formatClock } from "@/lib/format";
import {
  bubbleTone,
  ChannelAvatar,
  ChannelMeta,
  DecisionTag,
  LangTag,
  Marked,
  TypingDots,
} from "./row-parts";
import type { InterimLine, TranslationView } from "./state";

export type ViewMode = "both" | "source" | "translation";

interface RowFrameProps {
  startMs: number;
  channel: Channel;
  animate?: boolean;
  highlight?: boolean;
  id?: string;
  /** Focusable by script (arrow keys move between rows), not part of the tab order. */
  navigable?: boolean;
  /** Rendered under the bubble (conclusion chip). */
  footer?: ReactNode;
  children: ReactNode;
}

/** Avatar gutter + (name, time, bubble). The vertical gap between rows lives in the padding. */
function RowFrame({
  startMs,
  channel,
  animate = false,
  highlight = false,
  id,
  navigable = false,
  footer,
  children,
}: RowFrameProps) {
  return (
    <div
      id={id}
      tabIndex={navigable ? -1 : undefined}
      data-seg-row={navigable ? "" : undefined}
      className={clsx(
        "px-4 py-[9px] outline-none focus-visible:bg-soft-inset focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset sm:px-8",
        highlight && "bg-soft-inset",
        animate && "animate-segment-in",
      )}
    >
      <div className="mx-auto grid max-w-[840px] grid-cols-[34px_minmax(0,1fr)] gap-x-2.5 sm:gap-x-3.5">
        <ChannelAvatar channel={channel} />
        <div className="max-w-[74ch] min-w-0">
          <ChannelMeta channel={channel} time={formatClock(startMs)} />
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}

function TranslationLine(props: {
  translation: TranslationView;
  view: ViewMode;
  terms: readonly string[] | undefined;
}) {
  const { translation, view, terms } = props;
  return (
    <p
      className={clsx(
        "leading-relaxed",
        view === "translation" ? "text-transcript text-fg" : "mt-1 text-[14px] text-fg-muted",
      )}
    >
      <LangTag lang={translation.lang} />
      <Marked text={translation.text} terms={terms} />
    </p>
  );
}

interface SegmentRowProps {
  segment: Segment;
  translation: TranslationView | undefined;
  view: ViewMode;
  decision: boolean;
  animate: boolean;
  highlight?: boolean;
  /** Folded search words to mark inside the text (stable array while a search is shown). */
  terms?: readonly string[];
}

function SegmentRowBase({
  segment,
  translation,
  view,
  decision,
  animate,
  highlight = false,
  terms,
}: SegmentRowProps) {
  const original = (
    <p className="text-transcript text-fg">
      <Marked text={segment.text} terms={terms} />
    </p>
  );
  const translated = translation && (
    <TranslationLine translation={translation} view={view} terms={terms} />
  );
  return (
    <RowFrame
      id={`seg-${segment.id}`}
      startMs={segment.startMs}
      channel={segment.channel}
      animate={animate}
      highlight={highlight}
      navigable
      footer={decision ? <DecisionTag /> : undefined}
    >
      <Bubble tone={bubbleTone(segment.channel)} emphasis={decision ? "decision" : undefined}>
        {view === "translation" ? (
          (translated ?? (
            <p className="text-transcript text-fg-muted">
              <Marked text={segment.text} terms={terms} />
            </p>
          ))
        ) : (
          <>
            {original}
            {view === "both" && translated}
          </>
        )}
      </Bubble>
    </RowFrame>
  );
}

export const SegmentRow = memo(SegmentRowBase);

/** Not yet final: dashed bubble, italic text, typing dots. */
export function InterimRow({ channel, line }: { channel: Channel; line: InterimLine }) {
  return (
    <RowFrame startMs={line.startMs} channel={channel}>
      <Bubble tone="dashed">
        <p className="text-transcript text-fg-muted italic">
          {line.text}
          <TypingDots />
        </p>
      </Bubble>
    </RowFrame>
  );
}
