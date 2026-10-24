export type MinutesAction = "generate" | "save" | "load";

export class MinutesApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const GENERATE_BY_STATUS: Record<number, string> = {
  409: "Cuộc họp chưa kết thúc nên chưa lập được biên bản. Hãy dừng ghi trước.",
  422: "Cuộc họp chưa có nội dung để lập biên bản. Hãy ghi âm trước.",
  502: "Dịch vụ tạo biên bản trả về lỗi. Hãy thử lại sau ít giây.",
  503: "Dịch vụ tạo biên bản chưa được cấu hình. Kiểm tra khóa API của máy chủ rồi thử lại.",
};

const SAVE_BY_STATUS: Record<number, string> = {
  400: "Nội dung biên bản không hợp lệ. Kiểm tra các ô để trống hoặc quá dài.",
  404: "Biên bản không còn tồn tại. Hãy tạo lại biên bản.",
};

const FALLBACK: Record<MinutesAction, string> = {
  generate: "Không tạo được biên bản. Hãy thử lại.",
  save: "Chưa lưu được biên bản. Các chỉnh sửa vẫn còn trên màn hình, hãy thử lưu lại.",
  load: "Không tải được biên bản. Tải lại trang rồi thử lại.",
};

/** Human Vietnamese for a failed minutes call. Network failures arrive with status 0. */
export function describeMinutesError(action: MinutesAction, error: unknown): string {
  if (!(error instanceof MinutesApiError)) return FALLBACK[action];
  if (error.status === 0) return "Không kết nối được ứng dụng. Kiểm tra mạng rồi thử lại.";
  const table =
    action === "generate" ? GENERATE_BY_STATUS : action === "save" ? SAVE_BY_STATUS : {};
  return table[error.status] ?? FALLBACK[action];
}
