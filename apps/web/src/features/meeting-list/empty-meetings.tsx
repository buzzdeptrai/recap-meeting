import Link from "next/link";
import { CalendarBlank, MagnifyingGlass, Plus, X } from "@phosphor-icons/react/dist/ssr";
import { Button, buttonVariants, Card, EmptyState } from "@recap/admin-ui";

const STEPS = [
  "Mở cuộc họp Zoom hoặc Teams bằng trình duyệt Chrome hoặc Edge, rồi bấm Bắt đầu ghi và chọn đúng tab.",
  "Lời nói được ghi và phiên âm ngay khi diễn ra, tách riêng phần của bạn và của người khác.",
  "Bản dịch hiện ngay dưới từng câu. Bấm K để đánh dấu một kết luận.",
];

/** No meeting exists at all. */
export function EmptyMeetings() {
  return (
    <Card>
      <EmptyState
        icon={<CalendarBlank />}
        title="Chưa có cuộc họp nào"
        description="Tạo cuộc họp đầu tiên để ghi lại và dịch Anh–Việt theo thời gian thực."
        action={
          <Link href="/meetings/new" className={buttonVariants({ variant: "primary" })}>
            <Plus size={16} />
            Cuộc họp mới
          </Link>
        }
      />
      <ol className="mx-auto mb-4 flex max-w-xl list-decimal flex-col gap-2 border-t border-soft-line pt-5 pl-5 text-[13px] text-soft-muted marker:font-soft-mono marker:text-xs">
        {STEPS.map((step) => (
          <li key={step} className="pl-1">
            {step}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Filters or search matched nothing. */
export function NoResults({ term, onClear }: { term: string; onClear: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={<MagnifyingGlass />}
        tone="blue"
        title={
          term ? `Không có cuộc họp nào khớp “${term}”` : "Không có cuộc họp nào phù hợp bộ lọc"
        }
        description="Thử từ khóa ngắn hơn hoặc bỏ bớt bộ lọc. Tìm kiếm không phân biệt dấu."
        action={
          <Button variant="outline" onClick={onClear} icon={<X size={16} />}>
            Xóa bộ lọc
          </Button>
        }
      />
    </Card>
  );
}
