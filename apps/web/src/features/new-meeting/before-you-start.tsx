import { FloatCard } from "@recap/admin-ui";

const STEPS = [
  "Mở Zoom hoặc Teams bằng trình duyệt Chrome hoặc Edge.",
  "Bấm Bắt đầu ghi, rồi chọn đúng tab cuộc họp.",
  "Tích “Chia sẻ âm thanh tab” trong hộp thoại của trình duyệt.",
  "Đeo tai nghe để micro không thu lại tiếng loa.",
];

/** Side card on the new-meeting page: the same four steps the room shows before recording. */
export function BeforeYouStart() {
  return (
    <FloatCard as="aside" aria-labelledby="h-before-start" padding="lg" className="self-start">
      <h2 id="h-before-start" className="text-base font-bold text-soft-ink">
        Trước khi bắt đầu
      </h2>
      <p className="mb-5 text-[13px] text-soft-muted">
        Làm theo thứ tự này để bản ghi đủ cả hai phía.
      </p>
      <ol className="flex flex-col gap-3">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-start gap-3 text-sm text-soft-ink">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-soft-accent-soft text-xs font-bold text-soft-accent-ink">
              {index + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 rounded-soft-inner bg-soft-inset p-3 text-[13px] text-soft-muted">
        <b className="text-soft-ink">Mẹo:</b> nếu người nói đổi qua lại giữa tiếng Anh và tiếng
        Việt, chọn “Lẫn Anh–Việt” để chép lời không bị lệch ngôn ngữ.
      </p>
    </FloatCard>
  );
}
