import Link from "next/link";
import type { MeetingListItemDto } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { formatVnTime } from "@/lib/vn-time";
import { roomHref } from "./meeting-format";
import {
  Counters,
  DurationCell,
  LangBadge,
  MeetingStatusBadge,
  MinutesBadges,
  SubLine,
} from "./meeting-parts";
import { ActionCluster } from "./row-actions";

/** Column template of the table (header and rows share it). Shown from 1280px. */
export const TABLE_COLUMNS = "xl:grid-cols-[minmax(0,1fr)_112px_168px_176px_124px]";

const LINK_CLASS =
  "row-link soft-focus truncate rounded-md font-semibold text-soft-ink after:absolute after:inset-0 after:content-[''] hover:text-soft-purple";

export const ROW_FOCUS =
  "has-[.row-link:focus-visible]:bg-soft-bg has-[.row-link:focus-visible]:shadow-[inset_0_0_0_2px_var(--soft-focus)]";

interface RowProps {
  meeting: MeetingListItemDto;
  /** Heading already shows the day, so the row only needs the time. */
  grouped: boolean;
  onCopy: (id: string) => void;
}

function TimeCell({ meeting, grouped }: Pick<RowProps, "meeting" | "grouped">) {
  if (grouped) {
    return (
      <span className="flex flex-col">
        <span className="soft-tabular text-[13px] font-semibold text-soft-ink">
          {formatVnTime(meeting.createdAt)}
        </span>
        <DurationCell meeting={meeting} />
      </span>
    );
  }
  const [date, time] = formatDateTime(meeting.createdAt).split(" ");
  return (
    <span className="flex flex-col">
      <span className="soft-tabular text-[13px] font-semibold text-soft-ink">
        {date} <span className="font-medium text-soft-muted">{time}</span>
      </span>
      <DurationCell meeting={meeting} />
    </span>
  );
}

/** Table row (xl and up): whole row is one stretched link; actions float over the right edge. */
export function MeetingRow({ meeting, grouped, onCopy }: RowProps) {
  return (
    <div
      className={`group relative hidden items-center gap-x-4 px-5 py-3 transition-colors duration-150 hover:bg-soft-bg xl:grid ${TABLE_COLUMNS} ${ROW_FOCUS}`}
    >
      <span className="min-w-0">
        <Link href={roomHref(meeting.id)} className={`${LINK_CLASS} block`}>
          {meeting.title}
        </Link>
        <SubLine meeting={meeting} />
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
      <div className="absolute inset-y-0 right-0 z-10 flex items-center bg-soft-bg pr-4 pl-6 opacity-0 shadow-[-20px_0_14px_-4px_var(--soft-bg)] transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <ActionCluster meeting={meeting} onCopy={onCopy} />
      </div>
    </div>
  );
}

/** Column captions above the table rows. */
export function TableHead() {
  const cell = "text-[11px] font-bold uppercase tracking-[0.08em] text-soft-muted";
  return (
    <div
      className={`hidden items-center gap-x-4 border-b border-soft-line px-5 py-2.5 xl:grid ${TABLE_COLUMNS} ${cell}`}
    >
      <span>Tiêu đề</span>
      <span>Thời gian</span>
      <span>Nội dung</span>
      <span>Biên bản</span>
      <span>Trạng thái</span>
    </div>
  );
}
