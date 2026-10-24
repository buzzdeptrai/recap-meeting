import { FloatCard, Skeleton } from "@recap/admin-ui";
import { MeetingSkeleton } from "@/features/meeting-list/meeting-skeleton";

/** Meetings list while the server renders: the same floating cards, no layout jump. */
export default function MeetingsLoading() {
  return (
    <div data-page-tint="" aria-busy="true" aria-live="polite">
      <span className="sr-only">Đang tải…</span>
      <FloatCard as="header" className="mb-4" bodyClassName="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="mt-2 h-3.5 w-24" />
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-full" />
      </FloatCard>
      <MeetingSkeleton />
    </div>
  );
}
