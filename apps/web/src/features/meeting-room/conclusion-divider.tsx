import clsx from "clsx";
import { Chip } from "@recap/admin-ui";
import type { Mark } from "@recap/core";
import { formatClock } from "@/lib/format";
import { rowStyle, type Density } from "./density";

interface ConclusionDividerProps {
  mark: Mark;
  density: Density;
}

/** DOM id of the divider, the landing spot of a jump from the "Kết luận" list. */
export const conclusionDomId = (markId: string) => `conclusion-${markId}`;

/** Accessible name: "Kết luận lúc 00:04:42" plus the label when there is one. */
export function conclusionAriaLabel(mark: Mark): string {
  const label = mark.label?.trim();
  const base = `Kết luận lúc ${formatClock(mark.atMs)}`;
  return label ? `${base}: ${label}` : base;
}

/** One line in the transcript: amber chip, full time, optional label, then a thin amber rule. */
export function ConclusionDivider({ mark, density }: ConclusionDividerProps) {
  const label = mark.label?.trim();
  return (
    <div
      id={conclusionDomId(mark.id)}
      data-conclusion-id={mark.id}
      role="separator"
      aria-label={conclusionAriaLabel(mark)}
      className={clsx("flex items-center gap-2.5", rowStyle(density).conclusion)}
    >
      <Chip tone="decision" size="sm" className="shrink-0">
        Kết luận
      </Chip>
      <span className="font-soft-mono shrink-0 text-[12px] text-soft-conclusion tabular-nums">
        {formatClock(mark.atMs)}
      </span>
      {label && <span className="min-w-0 truncate text-small text-fg-muted">{label}</span>}
      <span aria-hidden className="h-px min-w-4 flex-1 bg-soft-conclusion/40" />
    </div>
  );
}
