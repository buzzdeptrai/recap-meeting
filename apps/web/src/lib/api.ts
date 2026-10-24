import type {
  ApiErrorBody,
  CreateMeetingBody,
  MeetingDetailDto,
  MeetingDto,
  MeetingListDto,
} from "./api-types";
import { toSearchParams, type ListState } from "./list-query";

const GENERIC_ERROR = "Không thể hoàn tất yêu cầu. Hãy thử lại sau ít giây.";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.error?.message ?? GENERIC_ERROR;
  } catch {
    return GENERIC_ERROR;
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error("Không kết nối được ứng dụng. Kiểm tra mạng rồi thử lại.", { cause: err });
  }
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function createMeeting(body: CreateMeetingBody): Promise<MeetingDto> {
  const result = await request<{ meeting: MeetingDto }>("/api/meetings", jsonInit("POST", body));
  return result.meeting;
}

export async function renameMeeting(id: string, title: string): Promise<MeetingDto> {
  const result = await request<{ meeting: MeetingDto }>(
    `/api/meetings/${encodeURIComponent(id)}`,
    jsonInit("PATCH", { title }),
  );
  return result.meeting;
}

export function fetchMeetingDetail(id: string): Promise<MeetingDetailDto> {
  return request<MeetingDetailDto>(`/api/meetings/${encodeURIComponent(id)}`);
}

export interface MeetingListQuery {
  state: ListState;
  limit?: number;
  offset?: number;
}

export function fetchMeetingList(
  query: MeetingListQuery,
  signal?: AbortSignal,
): Promise<MeetingListDto> {
  const params = toSearchParams(query.state);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  return request<MeetingListDto>(`/api/meetings?${params}`, { signal });
}
