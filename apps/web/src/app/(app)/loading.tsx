import { Card, Skeleton } from "@recap/admin-ui";

/** Shell-level skeleton while a page's server data loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="mb-2 h-4 w-32" />
      <Skeleton className="mb-6 h-9 w-56" />
      <div className="grid grid-cols-12 gap-6 max-[640px]:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="col-span-3 max-[1100px]:col-span-6 max-[640px]:col-span-12">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </Card>
        ))}
        <Card className="col-span-7 h-80 max-[1100px]:col-span-12">
          <Skeleton className="h-full w-full" />
        </Card>
        <Card className="col-span-5 h-80 max-[1100px]:col-span-12">
          <Skeleton className="h-full w-full" />
        </Card>
      </div>
    </div>
  );
}
