import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { IconTile } from "./icon-tile";
import type { Tone } from "./tone";

export interface EmptyStateProps {
  icon?: ReactNode;
  tone?: Tone;
  title: ReactNode;
  description?: ReactNode;
  /** Button / link. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  tone = "main",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      {icon ? <IconTile tone={tone}>{icon}</IconTile> : null}
      <p className="text-base font-bold text-soft-ink">{title}</p>
      {description ? <p className="max-w-sm text-[13px] text-soft-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
