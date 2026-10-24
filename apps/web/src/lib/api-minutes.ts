import type { MinutesContent, MinutesLang } from "@recap/core";
import { MinutesApiError } from "@/features/minutes/error-copy";
import type { ApiErrorBody, MinutesDto, MinutesRunDto } from "./api-types";

async function call(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new MinutesApiError(0, "NETWORK", "network");
  }
}

async function failure(response: Response): Promise<MinutesApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new MinutesApiError(response.status, body.error.code, body.error.message);
  } catch {
    return new MinutesApiError(response.status, "UNKNOWN", "unknown");
  }
}

const base = (meetingId: string) => `/api/meetings/${encodeURIComponent(meetingId)}/minutes`;

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/** Resolves null when no minutes exist yet for this language. */
export async function fetchMinutes(
  meetingId: string,
  lang: MinutesLang,
): Promise<MinutesDto | null> {
  const response = await call(`${base(meetingId)}?lang=${lang}`);
  if (response.status === 404) {
    const error = await failure(response);
    if (error.code === "MINUTES_NOT_FOUND") return null;
    throw error;
  }
  if (!response.ok) throw await failure(response);
  return (await response.json()) as MinutesDto;
}

/** Starts (or joins) a background generation; resolves with the run to poll. */
export async function startMinutesRun(
  meetingId: string,
  lang: MinutesLang,
): Promise<MinutesRunDto> {
  const response = await call(base(meetingId), jsonInit("POST", { lang }));
  if (!response.ok) throw await failure(response);
  return (await response.json()) as MinutesRunDto;
}

/** Latest generation run for this language; null when none has been started yet. */
export async function fetchMinutesRun(
  meetingId: string,
  lang: MinutesLang,
): Promise<MinutesRunDto | null> {
  const response = await call(`${base(meetingId)}/run?lang=${lang}`);
  if (response.status === 404) {
    const error = await failure(response);
    if (error.code === "RUN_NOT_FOUND") return null;
    throw error;
  }
  if (!response.ok) throw await failure(response);
  return (await response.json()) as MinutesRunDto;
}

export async function saveMinutes(
  meetingId: string,
  lang: MinutesLang,
  content: MinutesContent,
): Promise<MinutesDto> {
  const response = await call(base(meetingId), jsonInit("PUT", { lang, content }));
  if (!response.ok) throw await failure(response);
  return (await response.json()) as MinutesDto;
}
