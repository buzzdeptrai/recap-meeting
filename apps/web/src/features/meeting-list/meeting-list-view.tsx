import { Card } from "@recap/admin-ui";
import { Fragment } from "react";
import type { MeetingListItemDto } from "@/lib/api-types";
import type { ListState } from "@/lib/list-query";
import { groupByDay } from "@/lib/vn-time";
import { MeetingCard } from "./meeting-card";
import { MeetingRow, TableHead } from "./meeting-row";
import type { ViewMode } from "./view-mode";

interface ListViewProps {
  meetings: MeetingListItemDto[];
  state: ListState;
  mode: ViewMode;
  now: number;
  onCopy: (id: string) => void;
}

/** Day headings only make sense when rows run in date order. */
export function isDateOrdered(state: ListState): boolean {
  const sort = state.sort;
  if (sort === "auto") return state.q.trim() === "";
  return sort === "newest" || sort === "oldest";
}

function DayHeading({ heading, count }: { heading: string; count: number }) {
  return (
    <h3 className="sticky top-0 z-20 flex items-center justify-between border-y border-soft-line bg-soft-surface/95 px-4 py-2 text-xs font-bold text-soft-muted backdrop-blur first:border-t-0 sm:px-5 max-[860px]:top-[72px]">
      <span>{heading}</span>
      <span className="soft-tabular font-semibold">{count} cuộc họp</span>
    </h3>
  );
}

/** Rows grouped by Vietnam calendar day (date sorts) or one flat list (relevance, duration, name). */
export function MeetingListView({ meetings, state, mode, now, onCopy }: ListViewProps) {
  const grouped = isDateOrdered(state);
  const groups = grouped
    ? groupByDay(meetings, (m) => m.createdAt, now)
    : [{ key: "all", heading: "", items: meetings }];
  const rowProps = { grouped, onCopy };
  if (mode === "cards") return <CardGrid groups={groups} rowProps={rowProps} />;
  return (
    <Card as="section" padding="none" aria-label="Danh sách cuộc họp">
      <TableHead />
      {groups.map((group) => (
        <Fragment key={group.key}>
          {group.heading ? <DayHeading heading={group.heading} count={group.items.length} /> : null}
          <ul className="divide-y divide-soft-line">
            {group.items.map((meeting) => (
              <li key={meeting.id}>
                <MeetingRow meeting={meeting} {...rowProps} />
                <div className="xl:hidden">
                  <MeetingCard meeting={meeting} layout="list" {...rowProps} />
                </div>
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
    </Card>
  );
}

interface GridProps {
  groups: ReturnType<typeof groupByDay<MeetingListItemDto>>;
  rowProps: { grouped: boolean; onCopy: (id: string) => void };
}

function CardGrid({ groups, rowProps }: GridProps) {
  return (
    <section aria-label="Danh sách cuộc họp" className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.key}>
          {group.heading ? (
            <h3 className="mb-2 px-1 text-xs font-bold text-soft-muted">{group.heading}</h3>
          ) : null}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:grid-cols-4">
            {group.items.map((meeting) => (
              <li key={meeting.id}>
                <MeetingCard meeting={meeting} layout="tile" {...rowProps} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
