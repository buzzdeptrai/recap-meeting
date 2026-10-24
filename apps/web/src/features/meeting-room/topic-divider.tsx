import { Flag } from "@phosphor-icons/react";
import type { Mark } from "@recap/core";
import { formatClock } from "@/lib/format";

interface TopicDividerProps {
  mark: Mark;
  name: string;
}

/** Hard boundary between topics in the transcript. */
export function TopicDivider({ mark, name }: TopicDividerProps) {
  return (
    <div
      id={`topic-${mark.id}`}
      role="separator"
      aria-label={`Chủ đề: ${name}`}
      className="mt-3 grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3 border-t border-line py-2.5 pr-4 pl-3 sm:grid-cols-[72px_minmax(0,1fr)]"
    >
      <span className="font-mono text-meta text-accent">{formatClock(mark.atMs)}</span>
      <span className="flex min-w-0 items-center gap-2">
        <Flag size={14} weight="fill" className="shrink-0 text-accent" aria-hidden />
        <span className="text-label font-bold uppercase tracking-[0.08em] text-fg-muted">
          Chủ đề
        </span>
        <span className="truncate text-base font-semibold text-fg">{name}</span>
      </span>
    </div>
  );
}
