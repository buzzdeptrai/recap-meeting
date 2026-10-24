import { Microphone, SpeakerHigh } from "@phosphor-icons/react";
import { Chip, IconBadge, type BubbleTone } from "@recap/admin-ui";
import clsx from "clsx";
import type { ReactNode } from "react";
import type { Channel } from "@recap/core";
import { splitByTerms } from "@/lib/text-match";

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
export function ChannelAvatar({ channel }: { channel: Channel }) {
  const { tone, icon } = CHANNEL_STYLE[channel];
  return <IconBadge tone={tone}>{icon}</IconBadge>;
}

/** Sentence-case speaker name and the mono start time. */
export function ChannelMeta({ channel, time }: { channel: Channel; time: string }) {
  const { label, ink } = CHANNEL_STYLE[channel];
  return (
    <div className="mx-1 mb-[5px] flex items-baseline gap-2.5">
      <span className={clsx("text-[13px] font-semibold", ink)}>{label}</span>
      <span className="font-soft-mono text-[12px] text-soft-muted">{time}</span>
    </div>
  );
}

export function DecisionTag({ time }: { time?: string }) {
  return (
    <Chip tone="decision" size="md" className="mt-1.5 ml-1">
      Kết luận
      {time ? <span className="font-soft-mono font-medium opacity-80">{time}</span> : null}
    </Chip>
  );
}

export function LangTag({ lang }: { lang: string }) {
  return (
    <Chip tone="outline" size="sm" className="mr-2 align-[1px] uppercase">
      {lang}
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
