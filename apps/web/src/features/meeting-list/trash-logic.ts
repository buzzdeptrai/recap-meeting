import type { MeetingStatus } from "@recap/db";

/** Why a meeting cannot be deleted right now, or null when it can. */
export function deleteBlockedReason(meeting: { status: MeetingStatus }): string | null {
  return meeting.status === "live" ? "Cuộc họp đang ghi, hãy dừng ghi trước khi xóa" : null;
}

export const DELETE_TITLE = "Xóa cuộc họp này?";
export const TRASH_NAME = "Đã xóa gần đây";

/** Body of the delete confirmation: what happens and how to undo it. */
export function deleteDescription(title: string): string {
  return `Cuộc họp “${title}” sẽ biến mất khỏi danh sách. Nội dung, biên bản và file ghi âm vẫn được giữ, bạn có thể khôi phục từ mục “${TRASH_NAME}”.`;
}
