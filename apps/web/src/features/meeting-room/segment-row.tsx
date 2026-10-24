import clsx from "clsx";
import { memo, type ReactNode } from "react";
import type { Channel, Segment } from "@recap/core";
import { formatClock } from "@/lib/format";
import { splitByTerms } from "@/lib/text-match";
import type { InterimLine, TranslationView } from "./state";

export type ViewMode = "both" | "source" | "translation";

const CHANNEL_STYLE: Record<Channel, { label: string; color: string }> = {
  0: { label: "Tôi", color: "text-accent" },
  1: { label: "Người khác", color: "text-others" },
};

function ChannelLabel({ channel }: { channel: Channel }) {
  const { label, color } = CHANNEL_STYLE[channel];
  return (
    <span className={clsx("text-label font-bold uppercase tracking-[0.08em]", color)}>{label}</span>
  );
}

function DecisionTag() {
  return (
    <span className="rounded-[3px] bg-decision-bg px-1.5 text-label font-bold uppercase tracking-[0.08em] text-decision">
      Kết luận
    </span>
  );
}

function LangTag({ lang }: { lang: string }) {
  return (
    <span className="mr-2 inline-block rounded-[3px] border border-line px-1 align-[1px] text-label font-bold uppercase text-fg-muted">
      {lang}
    </span>
  );
}

/** Text with the words matching the active search wrapped in <mark>. */
function Marked({ text, terms }: { text: string; terms: readonly string[] | undefined }) {
  if (!terms || terms.length === 0) return text;
  return splitByTerms(text, terms).map((part, index) =>
    part.hit ? (
      <mark key={index} className="rounded-[3px] bg-accent/20 px-px text-inherit">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

interface RowFrameProps {
  startMs: number;
  channel: Channel;
  decision?: boolean;
  animate?: boolean;
  highlight?: boolean;
  id?: string;
  /** Focusable by script (arrow keys move between rows), not part of the tab order. */
  navigable?: boolean;
  children: ReactNode;
}

function RowFrame({
  startMs,
  channel,
  decision = false,
  animate = false,
  highlight = false,
  id,
  navigable = false,
  children,
}: RowFrameProps) {
  return (
    <div
      id={id}
      tabIndex={navigable ? -1 : undefined}
      data-seg-row={navigable ? "" : undefined}
      className={clsx(
        "outline-none focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
        "grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 border-l-2 py-2.5 pr-4 pl-3 sm:grid-cols-[72px_minmax(0,1fr)]",
        decision ? "border-decision" : "border-transparent",
        animate && "animate-segment-in",
        highlight && "bg-surface-2",
      )}
    >
      <span className="pt-[3px] font-mono text-meta text-fg-muted">{formatClock(startMs)}</span>
      <div className="max-w-[72ch] min-w-0">
        <div className="flex items-center gap-2">
          <ChannelLabel channel={channel} />
          {decision && <DecisionTag />}
        </div>
        {children}
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
        view === "translation" ? "text-transcript text-fg" : "mt-0.5 text-[14px] text-fg-muted",
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
      decision={decision}
      animate={animate}
      highlight={highlight}
      navigable
    >
      {view === "translation" ? (
        <>
          {translated ?? (
            <p className="text-transcript text-fg-muted">
              <Marked text={segment.text} terms={terms} />
            </p>
          )}
        </>
      ) : (
        <>
          {original}
          {view === "both" && translated}
        </>
      )}
    </RowFrame>
  );
}

export const SegmentRow = memo(SegmentRowBase);

/** Lighter, italic, not yet final. */
export function InterimRow({ channel, line }: { channel: Channel; line: InterimLine }) {
  return (
    <RowFrame startMs={line.startMs} channel={channel}>
      <p className="text-transcript text-fg-muted italic">{line.text}</p>
    </RowFrame>
  );
}
