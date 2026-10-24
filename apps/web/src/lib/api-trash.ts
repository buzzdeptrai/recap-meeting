import { request } from "./api";
import type { DeletedMeetingListDto, MeetingDto } from "./api-types";

const meetingUrl = (id: string) => `/api/meetings/${encodeURIComponent(id)}`;

/** Soft delete: the meeting disappears from every list but can be restored. */
export async function deleteMeetingRest(id: string): Promise<MeetingDto> {
  const result = await request<{ meeting: MeetingDto }>(meetingUrl(id), { method: "DELETE" });
  return result.meeting;
}

export async function restoreMeetingRest(id: string): Promise<MeetingDto> {
  const result = await request<{ meeting: MeetingDto }>(`${meetingUrl(id)}/restore`, {
    method: "POST",
  });
  return result.meeting;
}

export function fetchDeletedMeetings(signal?: AbortSignal): Promise<DeletedMeetingListDto> {
  return request<DeletedMeetingListDto>("/api/meetings?deleted=1&limit=100", { signal });
}
