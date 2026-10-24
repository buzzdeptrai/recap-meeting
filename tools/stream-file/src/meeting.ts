import { createRepositories, openDatabase } from "@recap/db";
import type { SourceLang, TargetLang } from "@recap/core";

const REST_TIMEOUT_MS = 2_000;

export interface NewMeeting {
  title: string;
  sourceLang: SourceLang;
  targetLang: TargetLang;
}

export interface CreatedMeeting {
  id: string;
  via: "web-rest" | "database";
}

async function createViaRest(webUrl: string, meeting: NewMeeting): Promise<string | null> {
  try {
    const response = await fetch(`${webUrl.replace(/\/$/, "")}/api/meetings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(meeting),
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { meeting?: { id?: string } };
    return body.meeting?.id ?? null;
  } catch {
    return null;
  }
}

function createViaDatabase(dbPath: string, meeting: NewMeeting): string {
  const db = openDatabase(dbPath);
  try {
    return createRepositories(db).meetings.create(meeting).id;
  } finally {
    db.close();
  }
}

/** Web REST first (same path as the UI); falls back to writing the shared SQLite file. */
export async function createMeeting(
  meeting: NewMeeting,
  options: { webUrl: string; dbPath: string },
): Promise<CreatedMeeting> {
  const restId = await createViaRest(options.webUrl, meeting);
  if (restId) return { id: restId, via: "web-rest" };
  return { id: createViaDatabase(options.dbPath, meeting), via: "database" };
}
