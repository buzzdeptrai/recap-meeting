import clsx from "clsx";
import { Flag } from "@phosphor-icons/react";
import { Chip } from "@recap/admin-ui";
import type { Mark } from "@recap/core";
import { formatClock } from "@/lib/format";
import { rowStyle, type Density } from "./density";

interface TopicDividerProps {
  mark: Mark;
  name: string;
  density: Density;
}

/** Hard boundary between topics: a pill with the time and name between two dotted rules. */
export function TopicDivider({ mark, name, density }: TopicDividerProps) {
  return (
    <div
      id={`topic-${mark.id}`}
      role="separator"
      aria-label={`Chủ đề: ${name}`}
      className={clsx("flex items-center gap-3.5", rowStyle(density).divider)}
    >
      <span
        aria-hidden
        className="h-0 w-6 shrink-0 border-t-2 border-dotted border-soft-line-strong"
      />
      <Chip
        tone="info"
        size="lg"
        icon={<Flag weight="regular" />}
        className="min-w-0 font-semibold"
      >
        <span className="font-soft-mono text-[12px] font-medium opacity-80">
          {formatClock(mark.atMs)}
        </span>
        <span className="truncate">{name}</span>
      </Chip>
      <span aria-hidden className="h-0 flex-1 border-t-2 border-dotted border-soft-line-strong" />
    </div>
  );
}
