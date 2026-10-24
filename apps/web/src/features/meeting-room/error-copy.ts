import type { ErrorMessage } from "@recap/core";

/** Vietnamese, plain: what went wrong and what happens next. */
export function describeServerError(error: ErrorMessage): string {
  switch (error.code) {
    case "STT_UNAVAILABLE":
      return "Dịch vụ nhận dạng giọng nói tạm thời không dùng được. Hệ thống đang thử kết nối lại.";
    case "MEETING_NOT_FOUND":
      return "Máy chủ ghi âm không tìm thấy cuộc họp này. Tải lại trang rồi thử lại.";
    case "TRANSLATE_FAILED":
      return "Một câu chưa dịch được. Phần còn lại vẫn tiếp tục.";
    default:
      return `Máy chủ ghi âm gặp lỗi: ${error.message}`;
  }
}
