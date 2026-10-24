import { FloatCard, Skeleton } from "@recap/admin-ui";
import { TABLE_COLUMNS } from "./meeting-row";

const ROWS = 6;

/** Placeholder rows (same grid as the real table) while a query is in flight. */
export function MeetingSkeleton() {
  return (
    <FloatCard
      as="section"
      padding="none"
      bodyClassName="py-2"
      aria-label="Đang tải danh sách"
      aria-busy="true"
    >
      <ul>
        {Array.from({ length: ROWS }, (_, index) => (
          <li
            key={index}
            className={`grid items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5 max-xl:grid-cols-[1fr_auto] ${TABLE_COLUMNS}`}
          >
            <span className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="mt-2 h-3 w-4/5" />
              </span>
            </span>
            <Skeleton className="h-4 w-14 max-xl:hidden" />
            <Skeleton className="h-5 w-24 rounded-full max-xl:hidden" />
            <Skeleton className="h-5 w-24 rounded-full max-xl:hidden" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 justify-self-end rounded-full max-xl:hidden" />
          </li>
        ))}
      </ul>
    </FloatCard>
  );
}
