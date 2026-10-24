import type { MinutesRunKind } from "@recap/db";
import { MinutesError, type MinutesErrorCode } from "../errors";

/** Stored on runs; Vietnamese, curated, never derived from an error message. */
export const GENERIC_RUN_ERROR = "Không tạo được biên bản. Vui lòng thử lại.";
export const GENERIC_TRANSLATE_ERROR = "Không dịch được biên bản. Vui lòng thử lại.";
export const RESTART_RUN_ERROR = "Máy chủ khởi động lại khi đang tạo biên bản. Hãy thử lại.";
export const UNCLAIMED_RUN_ERROR = "Dịch vụ xử lý nền chưa chạy. Hãy thử lại sau.";

const MESSAGE_BY_CODE: Record<MinutesErrorCode, string> = {
  MEETING_NOT_FOUND: "Không tìm thấy cuộc họp này.",
  EMPTY_TRANSCRIPT: "Cuộc họp chưa có nội dung để lập biên bản.",
  INVALID_OUTPUT: "Mô hình trả về kết quả không hợp lệ. Vui lòng thử lại.",
  LLM_FAILED: GENERIC_RUN_ERROR,
  CONFIG: "Chưa cấu hình dịch vụ tạo biên bản.",
  SOURCE_MISSING: "Chưa có biên bản gốc để dịch.",
  OVERWRITE_PROTECTED: "Bản dịch đã được chỉnh sửa. Hãy xác nhận ghi đè rồi dịch lại.",
};

/**
 * Text that is safe to show and to store on a run: a curated message, never the original error
 * (which may carry request details such as keys or prompts).
 */
export function safeFailureMessage(err: unknown, kind: MinutesRunKind = "generate"): string {
  const generic = kind === "translate" ? GENERIC_TRANSLATE_ERROR : GENERIC_RUN_ERROR;
  if (!(err instanceof MinutesError)) return generic;
  if (err.code === "LLM_FAILED") return generic;
  return MESSAGE_BY_CODE[err.code] ?? generic;
}
