import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { Badge, buttonVariants, Card, CardHeader, CardLink, EmptyState } from "@recap/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { formatClock, formatDateTime } from "@/lib/format";
import { MEETING_STATUS } from "@/lib/status";
import type { RecentRow } from "./dashboard-model";

export function DashboardRecent({ rows, className }: { rows: RecentRow[]; className?: string }) {
  return (
    <Card as="section" aria-labelledby="h-rec" className={className}>
      <CardHeader
        titleId="h-rec"
        title="Cuộc họp gần đây"
        description={rows.length ? `${rows.length} cuộc họp mới nhất` : undefined}
        action={<CardLink href="/meetings">Xem tất cả ›</CardLink>}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarBlank />}
          title="Chưa có cuộc họp nào"
          description="Tạo cuộc họp đầu tiên để bắt đầu chép lời và dịch."
          action={
            <Link href="/meetings/new" className={buttonVariants({ variant: "outline" })}>
              <Plus size={16} />
              Tạo cuộc họp mới
            </Link>
          }
        />
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="border-t border-soft-line first:border-t-0">
              <Link
                href={r.href}
                className="soft-focus -mx-2 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 rounded-xl px-2 py-3 hover:bg-soft-bg max-[640px]:grid-cols-[minmax(0,1fr)_auto]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{r.title}</span>
                  <span className="font-soft-mono text-xs text-soft-muted">
                    {formatDateTime(r.when)}
                    {r.durationMs !== null ? ` · ${formatClock(r.durationMs)}` : ""}
                  </span>
                </span>
                <MinutesChips row={r} />
                <StatusBadge status={MEETING_STATUS[r.status]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Which minutes exist, drawn like the meeting list; a finished meeting without any says so. */
function MinutesChips({ row }: { row: RecentRow }) {
  if (row.minutesLangs.length === 0) {
    return row.status === "ended" ? (
      <span className="text-xs text-soft-muted max-[640px]:hidden">Chưa có biên bản</span>
    ) : (
      <span className="max-[640px]:hidden" />
    );
  }
  return (
    <span className="inline-flex gap-1 max-[640px]:hidden" title="Đã có biên bản">
      <span className="sr-only">Đã có biên bản:</span>
      {row.minutesLangs.map((l) => (
        <Badge key={l} shape="chip" variant={l === "VI" ? "purple" : "cyan"}>
          {l}
        </Badge>
      ))}
    </span>
  );
}
