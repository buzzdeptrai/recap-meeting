import Link from "next/link";
import type { MeetingListItemDto } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { formatVnTime } from "@/lib/vn-time";
import { roomHref } from "./meeting-format";
import {
  Counters,
  DurationCell,
  LangBadge,
  MeetingIcon,
  MeetingStatusBadge,
  MinutesBadges,
  SubLine,
} from "./meeting-parts";
import { RowActions } from "./row-actions";

/** Column template of the table (header and rows share it). Shown from 1280px. */
export const TABLE_COLUMNS = "xl:grid-cols-[minmax(0,1fr)_96px_156px_160px_116px_148px]";

const LINK_CLASS =
  "row-link soft-focus truncate rounded-md font-semibold text-soft-ink after:absolute after:inset-0 after:content-[''] hover:text-soft-accent-ink";

export const ROW_FOCUS =
  "has-[.row-link:focus-visible]:bg-soft-inset has-[.row-link:focus-visible]:shadow-[inset_0_0_0_2px_var(--soft-focus)]";

interface RowProps {
  meeting: MeetingListItemDto;
  /** Heading already shows the day, so the row only needs the time. */
  grouped: boolean;
  onCopy: (id: string) => void;
}

function TimeCell({ meeting, grouped }: Pick<RowProps, "meeting" | "grouped">) {
  const [date, time] = formatDateTime(meeting.createdAt).split(" ");
  return (
    <span className="flex flex-col">
      <span className="soft-tabular text-[13px] font-semibold text-soft-ink">
        {grouped ? (
          formatVnTime(meeting.createdAt)
        ) : (
          <>
            {date} <span className="font-medium text-soft-muted">{time}</span>
          </>
        )}
      </span>
      <DurationCell meeting={meeting} />
    </span>
  );
}

/** Table row (xl and up): the whole row is one stretched link; actions sit above it in the last column. */
export function MeetingRow({ meeting, grouped, onCopy }: RowProps) {
  return (
    <div
      className={`group relative hidden items-center gap-x-4 px-5 py-3 transition-colors duration-150 hover:bg-soft-inset xl:grid ${TABLE_COLUMNS} ${ROW_FOCUS}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <MeetingIcon meeting={meeting} />
        <span className="min-w-0">
          <Link href={roomHref(meeting.id)} className={`${LINK_CLASS} block`}>
            {meeting.title}
          </Link>
          <SubLine meeting={meeting} />
        </span>
      </span>
      <TimeCell meeting={meeting} grouped={grouped} />
      <span className="flex flex-col items-start gap-1.5">
        <LangBadge meeting={meeting} />
        <Counters meeting={meeting} />
      </span>
      <MinutesBadges meeting={meeting} />
      <span>
        <MeetingStatusBadge meeting={meeting} />
      </span>
      <span className="flex justify-end">
        <RowActions meeting={meeting} onCopy={onCopy} />
      </span>
    </div>
  );
}

/** Column captions above the table rows (sentence case, like the rest of the room-style pages). */
export function TableHead() {
  return (
    <div
      className={`hidden items-center gap-x-4 px-5 pb-2 text-xs font-semibold text-soft-muted xl:grid ${TABLE_COLUMNS}`}
    >
      <span>Tiêu đề</span>
      <span>Thời gian</span>
      <span>Nội dung</span>
      <span>Biên bản</span>
      <span>Trạng thái</span>
      <span aria-hidden />
    </div>
  );
}
