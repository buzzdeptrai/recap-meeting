import { Microphone, SpeakerHigh } from "@phosphor-icons/react";
import { Chip, IconBadge, type BubbleTone } from "@recap/admin-ui";
import clsx from "clsx";
import type { ReactNode } from "react";
import type { Channel } from "@recap/core";
import { splitByTerms } from "@/lib/text-match";
import { rowStyle, type Density } from "./density";
import { formatGutterTime } from "./gutter-time";

type ChannelTone = "tone-a" | "tone-b";

export const CHANNEL_STYLE: Record<
  Channel,
  { label: string; tone: ChannelTone; ink: string; icon: ReactNode }
> = {
  0: { label: "Tôi", tone: "tone-a", ink: "text-soft-tone-a-ink", icon: <Microphone /> },
  1: { label: "Người khác", tone: "tone-b", ink: "text-soft-tone-b-ink", icon: <SpeakerHigh /> },
};

export const bubbleTone = (channel: Channel): BubbleTone => CHANNEL_STYLE[channel].tone;

/** Round channel icon in the left gutter (mic for me, speaker for the others). */
export function ChannelAvatar({ channel, density }: { channel: Channel; density: Density }) {
  const { tone, icon } = CHANNEL_STYLE[channel];
  return (
    <IconBadge tone={tone} className={clsx("row-span-2 self-start", rowStyle(density).avatar)}>
      {icon}
    </IconBadge>
  );
}

/** Sentence-case speaker name and the mono start time, on one line above the first bubble. */
export function ChannelMeta({
  channel,
  time,
  density,
}: {
  channel: Channel;
  time: string;
  density: Density;
}) {
  const { label, ink } = CHANNEL_STYLE[channel];
  return (
    <div className={clsx("col-start-2 flex items-baseline", rowStyle(density).meta)}>
      <span className={clsx("text-[13px] font-semibold", ink)}>{label}</span>
      <span className="font-soft-mono text-[12px] text-soft-muted">{time}</span>
    </div>
  );
}

/**
 * Time of a continuation row, right-aligned in the gutter; it may reach into the row padding.
 * Hidden until the row is hovered or focused, always shown on touch screens (no hover there).
 */
export function GutterTime({ ms }: { ms: number }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "font-soft-mono relative self-start text-[10px] leading-4 text-soft-muted tabular-nums",
        "opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 group-focus-visible/row:opacity-100 group-focus/row:opacity-100",
        "[@media(hover:none)]:opacity-100",
      )}
    >
      <span className="absolute top-[7px] right-0 whitespace-nowrap">{formatGutterTime(ms)}</span>
    </span>
  );
}

/** Speaker and time for assistive tech when the header is not drawn (continuation rows). */
export function SpokenBy({ channel, time }: { channel: Channel; time: string }) {
  return (
    <span className="sr-only">
      {CHANNEL_STYLE[channel].label}, {time}:{" "}
    </span>
  );
}

/** Language names; a translation tag appears only when it differs from the meeting's target. */
export const LANG_NAME: Record<string, string> = { vi: "Tiếng Việt", en: "Tiếng Anh" };

export function LangTag({ lang }: { lang: string }) {
  return (
    <Chip tone="outline" size="sm" className="mr-2 align-[1px]">
      {LANG_NAME[lang] ?? lang}
    </Chip>
  );
}

/** Three blinking dots after interim text (static under reduced motion). */
export function TypingDots() {
  return (
    <span aria-hidden="true" className="typing-dots ml-1.5 inline-flex gap-1 align-middle">
      <i />
      <i />
      <i />
    </span>
  );
}

/** Text with the words matching the active search wrapped in <mark>. */
export function Marked({ text, terms }: { text: string; terms: readonly string[] | undefined }) {
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
