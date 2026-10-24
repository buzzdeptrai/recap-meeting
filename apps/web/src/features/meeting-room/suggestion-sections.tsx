"use client";

import { ArrowUpRight, Sparkle } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Badge } from "@recap/admin-ui";
import { formatClock } from "@/lib/format";
import type { ConclusionSuggestion, TopicSuggestion } from "./minutes-suggestions";

export const SUGGESTIONS_HEADING = "Gợi ý từ biên bản";
export const SOURCE_CHIP = "Từ biên bản";
export const AI_CHIP = "AI đề xuất";

/** Small heading above a block of the side panel ("Mốc chủ đề (2)"). */
export function SectionHeading({ children, count }: { children: ReactNode; count: number }) {
  return (
    <h3 className="mb-2 px-1 text-[13px] font-semibold text-soft-muted">
      {children} ({count})
    </h3>
  );
}

/** Highlighted heading (sparkle icon, accent tint) so AI-derived items read differently from hand marks. */
function SuggestionsHeading({ count }: { count: number }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 rounded-full bg-soft-accent-soft px-3 py-1.5 text-[13px] font-semibold text-soft-accent-ink">
      <Sparkle size={14} weight="fill" aria-hidden />
      {SUGGESTIONS_HEADING} ({count})
    </h3>
  );
}

interface SuggestionCardProps {
  atMs: number;
  title: string;
  chips: string[];
  onJump: (atMs: number) => void;
}

function SuggestionCard({ atMs, title, chips, onJump }: SuggestionCardProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onJump(atMs)}
        className="soft-focus block w-full rounded-soft-inner bg-soft-inset px-3 py-2.5 text-left hover:bg-soft-fill"
      >
        <span className="line-clamp-3 block text-small text-soft-ink">{title}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="font-soft-mono text-meta text-fg-muted">{formatClock(atMs)}</span>
          {chips.map((chip) => (
            <Badge key={chip} shape="chip" variant={chip === AI_CHIP ? "accent" : "neutral"}>
              {chip}
            </Badge>
          ))}
          <ArrowUpRight size={14} aria-hidden className="ml-auto text-soft-accent-ink" />
        </span>
      </button>
    </li>
  );
}

interface SuggestionsProps<T> {
  items: T[];
  /** Candidates hidden because they duplicate a hand mark (explained under the list). */
  hidden?: number;
  onJump: (atMs: number) => void;
}

/** Tells the user why the list is shorter than the minutes ("1 mục trùng marker của bạn"). */
function HiddenNote({ count, noun }: { count: number; noun: string }) {
  if (count <= 0) return null;
  return (
    <p className="mt-2 px-1 text-meta text-fg-muted">
      Đã ẩn {count} {noun} trùng với mốc bạn đã đánh dấu.
    </p>
  );
}

/** Topics proposed by the minutes (below the hand-made topic markers). Hidden when empty. */
export function TopicSuggestions({ items, hidden = 0, onJump }: SuggestionsProps<TopicSuggestion>) {
  if (items.length === 0) return null;
  return (
    <section className="mt-4" aria-label={SUGGESTIONS_HEADING}>
      <SuggestionsHeading count={items.length} />
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <SuggestionCard
            key={item.id}
            atMs={item.atMs}
            title={item.title}
            chips={[SOURCE_CHIP]}
            onJump={onJump}
          />
        ))}
      </ul>
      <HiddenNote count={hidden} noun="chủ đề" />
    </section>
  );
}

/** Conclusions the AI proposed in the minutes (not hand-marked). Hidden when empty. */
export function ConclusionSuggestions({
  items,
  hidden = 0,
  onJump,
}: SuggestionsProps<ConclusionSuggestion>) {
  if (items.length === 0) return null;
  return (
    <section className="mt-4" aria-label={SUGGESTIONS_HEADING}>
      <SuggestionsHeading count={items.length} />
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <SuggestionCard
            key={item.id}
            atMs={item.atMs}
            title={item.text}
            chips={[SOURCE_CHIP, AI_CHIP]}
            onJump={onJump}
          />
        ))}
      </ul>
      <HiddenNote count={hidden} noun="kết luận" />
    </section>
  );
}
