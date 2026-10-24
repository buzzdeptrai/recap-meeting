import Link from "next/link";
import type { MeetingListItemDto } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { formatVnTime } from "@/lib/vn-time";
import { durationLabel, roomHref } from "./meeting-format";
import { ROW_FOCUS } from "./meeting-row";
import { Counters, LangBadge, MeetingStatusBadge, MinutesBadges, SubLine } from "./meeting-parts";
import { MoreMenu } from "./row-actions";

interface CardProps {
  meeting: MeetingListItemDto;
  grouped: boolean;
  onCopy: (id: string) => void;
  /** `list`: flat row inside a divided list (below 1280px). `tile`: standalone card in the grid. */
  layout: "list" | "tile";
}

const LAYOUT = {
  list: "px-4 py-3.5 transition-colors duration-150 hover:bg-soft-bg sm:px-5",
  tile: "h-full rounded-soft bg-soft-surface p-4 shadow-soft-sm transition-shadow duration-150 hover:shadow-soft sm:p-5",
} as const;

/** Stacked card: title + status, sub line, date/duration, minutes badges, "⋯". */
export function MeetingCard({ meeting, grouped, onCopy, layout }: CardProps) {
  const when = grouped ? formatVnTime(meeting.createdAt) : formatDateTime(meeting.createdAt);
  return (
    <div className={`group relative flex flex-col gap-2 ${LAYOUT[layout]} ${ROW_FOCUS}`}>
      <div className="flex items-start justify-between gap-3">
        <Link
          href={roomHref(meeting.id)}
          className="row-link soft-focus min-w-0 rounded-md font-semibold text-soft-ink after:absolute after:inset-0 after:content-[''] hover:text-soft-purple"
        >
          <span className="line-clamp-2">{meeting.title}</span>
        </Link>
        <MeetingStatusBadge meeting={meeting} />
      </div>
      <SubLine meeting={meeting} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-soft-muted">
        <span className="soft-tabular font-semibold text-soft-ink">{when}</span>
        <span aria-hidden>·</span>
        <span className="font-soft-mono">{durationLabel(meeting)}</span>
        <span className="max-sm:hidden">
          <LangBadge meeting={meeting} />
        </span>
        <span className="max-sm:hidden">
          <Counters meeting={meeting} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <MinutesBadges meeting={meeting} />
        <MoreMenu meeting={meeting} onCopy={onCopy} />
      </div>
    </div>
  );
}
