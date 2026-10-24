import Link from "next/link";
import type { MeetingListItemDto } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { formatVnTime } from "@/lib/vn-time";
import { durationLabel, roomHref } from "./meeting-format";
import { ROW_FOCUS } from "./meeting-row";
import {
  LangBadge,
  MeetingIcon,
  MeetingStatusBadge,
  MinutesBadges,
  SubLine,
} from "./meeting-parts";
import { RowActions } from "./row-actions";

interface CardProps {
  meeting: MeetingListItemDto;
  grouped: boolean;
  onCopy: (id: string) => void;
  /** `list`: flat row inside the list card (below 1280px). `tile`: floating card in the grid. */
  layout: "list" | "tile";
}

const LAYOUT = {
  list: "px-4 py-3.5 transition-colors duration-150 hover:bg-soft-inset sm:px-5",
  tile: "h-full rounded-soft-card bg-soft-surface p-4 shadow-soft-card transition-shadow duration-150 hover:shadow-soft-float sm:p-5",
} as const;

/** Stacked card: icon + title + status, sub line, date / duration / language, minutes chips, actions. */
export function MeetingCard({ meeting, grouped, onCopy, layout }: CardProps) {
  const when = grouped ? formatVnTime(meeting.createdAt) : formatDateTime(meeting.createdAt);
  return (
    <div className={`group relative flex flex-col gap-2.5 ${LAYOUT[layout]} ${ROW_FOCUS}`}>
      <div className="flex items-start gap-3">
        <MeetingIcon meeting={meeting} />
        <div className="min-w-0 flex-1">
          <Link
            href={roomHref(meeting.id)}
            className="row-link soft-focus block rounded-md font-semibold text-soft-ink after:absolute after:inset-0 after:content-[''] hover:text-soft-accent-ink"
          >
            <span className="line-clamp-2">{meeting.title}</span>
          </Link>
          <SubLine meeting={meeting} />
        </div>
        <span className="max-sm:hidden">
          <MeetingStatusBadge meeting={meeting} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-soft-muted">
        <span className="soft-tabular font-semibold text-soft-ink">{when}</span>
        {meeting.durationMs === null ? null : <span aria-hidden>·</span>}
        {meeting.durationMs === null ? null : (
          <span className="font-soft-mono">{durationLabel(meeting)}</span>
        )}
        <LangBadge meeting={meeting} />
        <span className="sm:hidden">
          <MeetingStatusBadge meeting={meeting} />
        </span>
      </div>
      <div className="flex min-h-10 items-center justify-between gap-2">
        {meeting.status === "ended" ? <MinutesBadges meeting={meeting} /> : <span />}
        <RowActions meeting={meeting} onCopy={onCopy} />
      </div>
    </div>
  );
}
