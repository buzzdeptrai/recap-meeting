import { Info } from "@phosphor-icons/react";

const STEPS = [
  "Mở Zoom hoặc Teams bằng trình duyệt Chrome hoặc Edge.",
  "Bấm Bắt đầu ghi, rồi chọn đúng tab cuộc họp.",
  "Tích “Chia sẻ âm thanh tab” trong hộp thoại của trình duyệt.",
  "Đeo tai nghe để micro không thu lại tiếng loa.",
];

/** The only numbered list in the app: these steps really are a sequence. */
export function SetupChecklist() {
  return (
    <div className="mx-auto max-w-[600px] px-5 py-10 sm:px-8 sm:py-14">
      <h2 className="text-[22px] font-bold">Chuẩn bị trước khi ghi</h2>
      <p className="mt-1 text-small text-soft-muted">
        Làm lần lượt bốn bước dưới đây, chừng một phút là xong.
      </p>
      <ol className="mt-6 flex flex-col gap-2.5">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className="flex items-center gap-3.5 rounded-soft-inner bg-soft-inset px-4 py-3.5"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-soft-surface font-soft-mono text-xs font-bold text-soft-accent-ink">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 flex items-center gap-2 text-[13px] text-soft-muted">
        <Info size={14} aria-hidden />
        Sẵn sàng thì bấm Bắt đầu ghi ở góc trên bên phải.
      </p>
    </div>
  );
}
