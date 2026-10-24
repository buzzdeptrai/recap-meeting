const STEPS = [
  "Mở Zoom hoặc Teams bằng trình duyệt Chrome hoặc Edge.",
  "Bấm Bắt đầu ghi, rồi chọn đúng tab cuộc họp.",
  "Tích “Chia sẻ âm thanh tab” trong hộp thoại của trình duyệt.",
  "Đeo tai nghe để micro không thu lại tiếng loa.",
];

/** The only numbered list in the app: these steps really are a sequence. */
export function SetupChecklist() {
  return (
    <div className="max-w-xl px-4 py-8 sm:px-6">
      <h2 className="text-[20px] font-bold">Chuẩn bị trước khi ghi</h2>
      <ol className="mt-5 flex flex-col divide-y divide-soft-line border-y border-soft-line">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-4 py-3">
            <span className="w-4 shrink-0 pt-px text-right font-soft-mono text-xs text-soft-muted">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-[13px] text-soft-muted">
        Sẵn sàng thì bấm Bắt đầu ghi ở góc trên bên phải.
      </p>
    </div>
  );
}
