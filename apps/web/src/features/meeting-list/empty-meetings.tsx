import { CalendarBlank, MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import { Button, EmptyState, FloatCard } from "@recap/admin-ui";
import { NewMeetingButton } from "./filter-bar";

/** No meeting exists at all: one sentence, one button. */
export function EmptyMeetings() {
  return (
    <FloatCard as="section" aria-label="Chưa có cuộc họp">
      <EmptyState
        icon={<CalendarBlank />}
        title="Chưa có cuộc họp nào"
        description="Tạo cuộc họp đầu tiên để ghi lại và dịch Anh–Việt ngay khi đang họp."
        action={<NewMeetingButton />}
      />
    </FloatCard>
  );
}

/** Filters or search matched nothing. */
export function NoResults({ term, onClear }: { term: string; onClear: () => void }) {
  return (
    <FloatCard as="section" aria-label="Không có kết quả">
      <EmptyState
        icon={<MagnifyingGlass />}
        tone="blue"
        title={term ? `Không thấy cuộc họp nào khớp “${term}”` : "Không có cuộc họp nào phù hợp"}
        description="Thử từ khóa ngắn hơn hoặc bỏ bớt bộ lọc. Tìm kiếm không phân biệt dấu."
        action={
          <Button variant="outline" shape="pill" onClick={onClear} icon={<X size={16} />}>
            Xóa bộ lọc
          </Button>
        }
      />
    </FloatCard>
  );
}
