import { Card, Skeleton } from "@recap/admin-ui";
import { TABLE_COLUMNS } from "./meeting-row";

const ROWS = 6;

/** Placeholder rows (same grid as the real table) while a query is in flight. */
export function MeetingSkeleton() {
  return (
    <Card as="section" padding="none" aria-label="Đang tải danh sách" aria-busy="true">
      <Skeleton className="mx-5 my-3 h-3 w-24" />
      <ul>
        {Array.from({ length: ROWS }, (_, index) => (
          <li
            key={index}
            className={`grid items-center gap-x-4 gap-y-2 border-t border-soft-line px-4 py-4 sm:px-5 max-xl:grid-cols-[1fr_auto] ${TABLE_COLUMNS}`}
          >
            <span>
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="mt-2 h-3 w-4/5" />
            </span>
            <Skeleton className="h-4 w-14 max-xl:hidden" />
            <Skeleton className="h-5 w-24 max-xl:hidden" />
            <Skeleton className="h-5 w-24 max-xl:hidden" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
