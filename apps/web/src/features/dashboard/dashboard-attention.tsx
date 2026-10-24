import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants, Card, CardHeader, CardLink, EmptyState } from "@recap/admin-ui";
import { formatDateTime } from "@/lib/format";
import type { AttentionItem, AttentionModel } from "./dashboard-model";

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <li className="flex items-center gap-4 border-t border-soft-line py-3 first:border-t-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{item.title}</span>
        <span className="block truncate text-xs text-soft-muted">
          {item.reason} · <span className="font-soft-mono">{formatDateTime(item.when)}</span>
        </span>
      </span>
      <Link
        href={item.href}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        aria-label={`${item.actionLabel}: ${item.title}`}
      >
        {item.actionLabel}
      </Link>
    </li>
  );
}

/** Compact "Cần xử lý" list: one outline action per row (the page keeps a single primary). */
export function DashboardAttention({
  attention,
  className,
}: {
  attention: AttentionModel;
  className?: string;
}) {
  const { items, total } = attention;
  return (
    <Card as="section" aria-labelledby="h-att" className={className}>
      <CardHeader
        titleId="h-att"
        title="Cần xử lý"
        description={total ? `${total} cuộc họp cần bạn xem lại` : undefined}
        action={
          total ? <CardLink href="/meetings?minutes=need">Xem danh sách ›</CardLink> : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle />}
          title="Không có gì tồn đọng"
          description="Cuộc họp đã kết thúc đều có biên bản và không có bản nháp bị bỏ quên."
        />
      ) : (
        <ul>
          {items.map((item) => (
            <AttentionRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}
