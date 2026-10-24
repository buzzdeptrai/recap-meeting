import type { StaleReason } from "@recap/db";

export const STALE_REASON_COPY: Record<StaleReason, string> = {
  transcript_changed: "Bản chép lời đã thay đổi sau khi tạo biên bản",
  marks_changed: "Dấu mốc đã được thêm hoặc đổi tên sau khi tạo biên bản",
  marks_removed: "Đã xoá hoặc đổi dấu mốc sau khi tạo",
  prompt_updated: "Biên bản được tạo bằng phiên bản prompt cũ",
  model_changed: "Biên bản được tạo bằng mô hình khác với mô hình hiện tại",
};

const CALL_TO_ACTION = "Tạo lại để cập nhật.";
const GENERIC = `Biên bản cũ hơn bản chép lời. ${CALL_TO_ACTION}`;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** One sentence for the stale banner: the reasons joined, then what to do. */
export function staleBannerText(reasons: readonly StaleReason[]): string {
  if (reasons.length === 0) return GENERIC;
  const parts = reasons.map((reason, i) =>
    i === 0 ? STALE_REASON_COPY[reason] : lowerFirst(STALE_REASON_COPY[reason]),
  );
  return `${parts.join("; ")}. ${CALL_TO_ACTION}`;
}
