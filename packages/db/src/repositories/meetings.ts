import type { SourceLang, TargetLang } from "@recap/core";
import type { Meeting, MeetingStatus, RepoContext } from "../types";
import { searchMeetings, type SearchMeetingsOptions } from "./meeting-search";

export interface MeetingRow {
  id: string;
  title: string;
  status: MeetingStatus;
  source_lang: string | null;
  target_lang: string | null;
  agenda: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
}

export interface CreateMeetingInput {
  title: string;
  sourceLang?: SourceLang | null;
  targetLang?: TargetLang | null;
  agenda?: string | null;
}

export interface ListMeetingsOptions {
  limit?: number;
  offset?: number;
}

const DEFAULT_LIST_LIMIT = 100;

export function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    sourceLang: row.source_lang as SourceLang | null,
    targetLang: row.target_lang as TargetLang | null,
    agenda: row.agenda,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
  };
}

const SELECT_BY_ID = "SELECT * FROM meetings WHERE id = ?";

function getMeeting({ db }: RepoContext, id: string): Meeting | undefined {
  const row = db.prepare<[string], MeetingRow>(SELECT_BY_ID).get(id);
  return row ? toMeeting(row) : undefined;
}

function createMeeting(ctx: RepoContext, input: CreateMeetingInput): Meeting {
  const id = ctx.newId();
  ctx.db
    .prepare(
      `INSERT INTO meetings (id, title, status, source_lang, target_lang, agenda, created_at)
       VALUES (@id, @title, 'draft', @sourceLang, @targetLang, @agenda, @createdAt)`,
    )
    .run({
      id,
      title: input.title,
      sourceLang: input.sourceLang ?? null,
      targetLang: input.targetLang ?? null,
      agenda: input.agenda ?? null,
      createdAt: ctx.now(),
    });
  return getMeeting(ctx, id) as Meeting;
}

function listMeetings({ db }: RepoContext, options: ListMeetingsOptions = {}): Meeting[] {
  return db
    .prepare<[number, number], MeetingRow>(
      "SELECT * FROM meetings ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?",
    )
    .all(options.limit ?? DEFAULT_LIST_LIMIT, options.offset ?? 0)
    .map(toMeeting);
}

function setColumn(ctx: RepoContext, id: string, column: "title" | "status", value: string) {
  ctx.db.prepare(`UPDATE meetings SET ${column} = ? WHERE id = ?`).run(value, id);
  return getMeeting(ctx, id);
}

/** Marks the meeting live. Keeps the original started_at when resuming. */
function startMeeting(ctx: RepoContext, id: string, startedAt: string = ctx.now()) {
  ctx.db
    .prepare(
      `UPDATE meetings SET status = 'live', started_at = COALESCE(started_at, ?),
         ended_at = NULL, duration_ms = NULL WHERE id = ?`,
    )
    .run(startedAt, id);
  return getMeeting(ctx, id);
}

/**
 * Marks the meeting ended. Duration defaults to wall clock since started_at; pass `durationMs`
 * (recorded audio length) for resumed meetings where wall clock includes the pauses.
 */
function endMeeting(
  ctx: RepoContext,
  id: string,
  endedAt: string = ctx.now(),
  recordedMs?: number,
) {
  const meeting = getMeeting(ctx, id);
  if (!meeting) return undefined;
  const wallClockMs = meeting.startedAt
    ? Math.max(0, Date.parse(endedAt) - Date.parse(meeting.startedAt))
    : null;
  const durationMs = recordedMs === undefined ? wallClockMs : Math.max(0, Math.round(recordedMs));
  ctx.db
    .prepare("UPDATE meetings SET status = 'ended', ended_at = ?, duration_ms = ? WHERE id = ?")
    .run(endedAt, durationMs, id);
  return getMeeting(ctx, id);
}

export function createMeetingsRepository(ctx: RepoContext) {
  return {
    create: (input: CreateMeetingInput) => createMeeting(ctx, input),
    get: (id: string) => getMeeting(ctx, id),
    list: (options?: ListMeetingsOptions) => listMeetings(ctx, options),
    search: (options?: SearchMeetingsOptions) => searchMeetings(ctx, options),
    updateTitle: (id: string, title: string) => setColumn(ctx, id, "title", title),
    updateStatus: (id: string, status: MeetingStatus) => setColumn(ctx, id, "status", status),
    start: (id: string, startedAt?: string) => startMeeting(ctx, id, startedAt),
    end: (id: string, endedAt?: string, recordedMs?: number) =>
      endMeeting(ctx, id, endedAt, recordedMs),
    remove: (id: string) => ctx.db.prepare("DELETE FROM meetings WHERE id = ?").run(id).changes > 0,
  };
}

export type MeetingsRepository = ReturnType<typeof createMeetingsRepository>;
