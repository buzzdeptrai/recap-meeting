import type { Meeting, RepoContext } from "../types";
import { toMeeting, type MeetingRow } from "./meetings";

export type SoftDeleteResult =
  { ok: true; meeting: Meeting } | { ok: false; reason: "not_found" | "live" };

export interface ListDeletedOptions {
  limit?: number;
  offset?: number;
}

export interface DeletedMeetingsPage {
  meetings: Meeting[];
  total: number;
}

const DEFAULT_LIMIT = 100;

function findAny({ db }: RepoContext, id: string): MeetingRow | undefined {
  return db.prepare<[string], MeetingRow>("SELECT * FROM meetings WHERE id = ?").get(id);
}

/**
 * Hides a meeting everywhere without removing any data. A `live` meeting is refused; deleting one
 * that is already deleted succeeds and keeps the original `deleted_at`.
 */
function softDeleteMeeting(ctx: RepoContext, id: string, deletedBy?: string): SoftDeleteResult {
  // One statement decides "not live and not yet deleted", so a meeting going live in between
  // (another process) can never be deleted by a stale read.
  const { changes } = ctx.db
    .prepare(
      `UPDATE meetings SET deleted_at = ?, deleted_by = ?
       WHERE id = ? AND status <> 'live' AND deleted_at IS NULL`,
    )
    .run(ctx.now(), deletedBy ?? null, id);
  const row = findAny(ctx, id);
  if (!row) return { ok: false, reason: "not_found" };
  if (changes === 0 && !row.deleted_at) return { ok: false, reason: "live" };
  return { ok: true, meeting: toMeeting(row) };
}

/** Brings a soft-deleted meeting back. Restoring a normal meeting is a no-op that returns it. */
function restoreMeeting(ctx: RepoContext, id: string): Meeting | undefined {
  const row = findAny(ctx, id);
  if (!row) return undefined;
  if (!row.deleted_at) return toMeeting(row);
  ctx.db.prepare("UPDATE meetings SET deleted_at = NULL, deleted_by = NULL WHERE id = ?").run(id);
  return toMeeting(findAny(ctx, id) as MeetingRow);
}

/** Soft-deleted meetings, most recently deleted first. */
function listDeletedMeetings(
  { db }: RepoContext,
  options: ListDeletedOptions = {},
): DeletedMeetingsPage {
  const rows = db
    .prepare<[number, number], MeetingRow>(
      `SELECT * FROM meetings WHERE deleted_at IS NOT NULL
       ORDER BY deleted_at DESC, rowid DESC LIMIT ? OFFSET ?`,
    )
    .all(options.limit ?? DEFAULT_LIMIT, options.offset ?? 0);
  const total = db
    .prepare("SELECT COUNT(*) FROM meetings WHERE deleted_at IS NOT NULL")
    .pluck()
    .get() as number;
  return { meetings: rows.map(toMeeting), total };
}

export function createMeetingTrash(ctx: RepoContext) {
  return {
    softDelete: (id: string, deletedBy?: string) => softDeleteMeeting(ctx, id, deletedBy),
    restore: (id: string) => restoreMeeting(ctx, id),
    listDeleted: (options?: ListDeletedOptions) => listDeletedMeetings(ctx, options),
  };
}
