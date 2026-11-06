import {
  DEFAULT_TEMPLATE_ID,
  ownerRestriction,
  type MeetingTemplateId,
  type MeetingViewer,
  type SourceLang,
  type TargetLang,
} from "@recap/core";
import type { Meeting, MeetingStatus, RepoContext } from "../types";
import { searchMeetings, type SearchMeetingsOptions } from "./meeting-search";
import { createMeetingRecovery } from "./meetings-recovery";
import { createMeetingTrash } from "./meetings-trash";

export interface MeetingRow {
  id: string;
  title: string;
  status: MeetingStatus;
  source_lang: string | null;
  target_lang: string | null;
  agenda: string | null;
  template_id: string;
  extra_instructions: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  deleted_at: string | null;
  owner_id: string | null;
}

export interface CreateMeetingInput {
  title: string;
  /**
   * Owner of the new meeting. Omitted/null = no owner (visible to admins only); only internal
   * tools and tests leave it out, the REST create always passes the signed-in user.
   */
  ownerId?: string | null;
  sourceLang?: SourceLang | null;
  targetLang?: TargetLang | null;
  agenda?: string | null;
  templateId?: MeetingTemplateId;
  extraInstructions?: string | null;
}

export interface UpdateMeetingSettings {
  templateId?: MeetingTemplateId;
  /** null / blank clears it; undefined leaves it. */
  extraInstructions?: string | null;
}

export interface ListMeetingsOptions {
  limit?: number;
  offset?: number;
  /** Soft-deleted meetings are hidden unless asked for (usage history needs their titles). */
  includeDeleted?: boolean;
  /** Only meetings this viewer may access (members: their own). Omitted = no scoping. */
  viewer?: MeetingViewer;
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
    templateId: row.template_id as MeetingTemplateId,
    extraInstructions: row.extra_instructions,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    deletedAt: row.deleted_at ?? null,
    ownerId: row.owner_id ?? null,
  };
}

const blankToNull = (text: string | null | undefined) => text?.trim() || null;

const SELECT_BY_ID = "SELECT * FROM meetings WHERE id = ? AND deleted_at IS NULL";

/** A soft-deleted meeting is invisible here: every caller (routes, realtime, worker) sees "not found". */
function getMeeting({ db }: RepoContext, id: string): Meeting | undefined {
  const row = db.prepare<[string], MeetingRow>(SELECT_BY_ID).get(id);
  return row ? toMeeting(row) : undefined;
}

function getAnyMeeting({ db }: RepoContext, id: string): Meeting | undefined {
  const row = db.prepare<[string], MeetingRow>("SELECT * FROM meetings WHERE id = ?").get(id);
  return row ? toMeeting(row) : undefined;
}

function createMeeting(ctx: RepoContext, input: CreateMeetingInput): Meeting {
  const id = ctx.newId();
  ctx.db
    .prepare(
      `INSERT INTO meetings (id, title, status, source_lang, target_lang, agenda, template_id, extra_instructions, owner_id, created_at)
       VALUES (@id, @title, 'draft', @sourceLang, @targetLang, @agenda, @templateId, @extraInstructions, @ownerId, @createdAt)`,
    )
    .run({
      id,
      title: input.title,
      sourceLang: input.sourceLang ?? null,
      targetLang: input.targetLang ?? null,
      agenda: input.agenda ?? null,
      templateId: input.templateId ?? DEFAULT_TEMPLATE_ID,
      extraInstructions: blankToNull(input.extraInstructions),
      ownerId: input.ownerId ?? null,
      createdAt: ctx.now(),
    });
  return getMeeting(ctx, id) as Meeting;
}

function listMeetings({ db }: RepoContext, options: ListMeetingsOptions = {}): Meeting[] {
  const owner = ownerRestriction(options.viewer);
  const filters = [
    ...(options.includeDeleted ? [] : ["deleted_at IS NULL"]),
    ...(owner === null ? [] : ["owner_id = @owner"]),
  ];
  return db
    .prepare<Record<string, unknown>, MeetingRow>(
      `SELECT * FROM meetings ${filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""}
       ORDER BY created_at DESC, rowid DESC LIMIT @limit OFFSET @offset`,
    )
    .all({
      ...(owner === null ? {} : { owner }),
      limit: options.limit ?? DEFAULT_LIST_LIMIT,
      offset: options.offset ?? 0,
    })
    .map(toMeeting);
}

function setColumn(ctx: RepoContext, id: string, column: "title" | "status", value: string) {
  ctx.db
    .prepare(`UPDATE meetings SET ${column} = ? WHERE id = ? AND deleted_at IS NULL`)
    .run(value, id);
  return getMeeting(ctx, id);
}

/** Template and/or extra instructions of a meeting; only the given fields change. */
function updateSettings(ctx: RepoContext, id: string, settings: UpdateMeetingSettings) {
  const current = getMeeting(ctx, id);
  if (!current) return undefined;
  const templateId = settings.templateId ?? current.templateId;
  const extraInstructions =
    settings.extraInstructions === undefined
      ? current.extraInstructions
      : blankToNull(settings.extraInstructions);
  ctx.db
    .prepare(
      "UPDATE meetings SET template_id = ?, extra_instructions = ? WHERE id = ? AND deleted_at IS NULL",
    )
    .run(templateId, extraInstructions, id);
  return getMeeting(ctx, id);
}

/** Marks the meeting live. Keeps the original started_at when resuming. */
function startMeeting(ctx: RepoContext, id: string, startedAt: string = ctx.now()) {
  ctx.db
    .prepare(
      `UPDATE meetings SET status = 'live', started_at = COALESCE(started_at, ?),
         ended_at = NULL, duration_ms = NULL WHERE id = ? AND deleted_at IS NULL`,
    )
    .run(startedAt, id);
  return getMeeting(ctx, id);
}

/**
 * Marks the meeting ended. Duration defaults to wall clock since started_at; pass `durationMs`
 * (recorded audio length) for resumed meetings where wall clock includes the pauses.
 * Idempotent: an already ended meeting keeps its ended_at / duration (a repeated end, e.g. the
 * socket-close path racing the explicit stop, must not move the timestamp). `start()` re-opens it.
 */
function endMeeting(
  ctx: RepoContext,
  id: string,
  endedAt: string = ctx.now(),
  recordedMs?: number,
) {
  const meeting = getMeeting(ctx, id);
  if (!meeting) return undefined;
  if (meeting.status === "ended" && meeting.endedAt) return meeting;
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
    /** Like `get` but also finds soft-deleted meetings (access checks on restore). */
    getIncludingDeleted: (id: string) => getAnyMeeting(ctx, id),
    list: (options?: ListMeetingsOptions) => listMeetings(ctx, options),
    search: (options?: SearchMeetingsOptions) => searchMeetings(ctx, options),
    updateTitle: (id: string, title: string) => setColumn(ctx, id, "title", title),
    updateSettings: (id: string, settings: UpdateMeetingSettings) =>
      updateSettings(ctx, id, settings),
    updateStatus: (id: string, status: MeetingStatus) => setColumn(ctx, id, "status", status),
    start: (id: string, startedAt?: string) => startMeeting(ctx, id, startedAt),
    end: (id: string, endedAt?: string, recordedMs?: number) =>
      endMeeting(ctx, id, endedAt, recordedMs),
    ...createMeetingTrash(ctx),
    ...createMeetingRecovery(ctx),
    remove: (id: string) => ctx.db.prepare("DELETE FROM meetings WHERE id = ?").run(id).changes > 0,
  };
}

export type MeetingsRepository = ReturnType<typeof createMeetingsRepository>;
