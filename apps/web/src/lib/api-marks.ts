import type { ApiErrorBody } from "./api-types";

const base = (meetingId: string, markId: string) =>
  `/api/meetings/${encodeURIComponent(meetingId)}/marks/${encodeURIComponent(markId)}`;

async function send(url: string, init: RequestInit): Promise<void> {
  const response = await fetch(url, init);
  if (response.ok) return;
  let message = "Không cập nhật được dấu. Hãy thử lại.";
  try {
    message = ((await response.json()) as ApiErrorBody).error?.message ?? message;
  } catch {
    // keep the generic message
  }
  throw new Error(message);
}

/** Ended meetings have no socket: marks are edited over REST. */
export function renameMarkRest(meetingId: string, markId: string, label: string): Promise<void> {
  return send(base(meetingId, markId), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label }),
  });
}

export function deleteMarkRest(meetingId: string, markId: string): Promise<void> {
  return send(base(meetingId, markId), { method: "DELETE" });
}
