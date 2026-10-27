import type { RepoContext, StoredNote } from "../types";

interface NoteRow {
  id: string;
  meeting_id: string;
  at_ms: number | null;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
  last_manual_edit: string;
}

export interface InsertNoteInput {
  meetingId: string;
  /** Offset into the meeting in ms; null/omitted = not time-stamped. */
  atMs?: number | null;
  content: string;
}

export interface UpdateNoteInput {
  content?: string;
  /** `undefined` keeps the offset, `null` clears it. */
  atMs?: number | null;
}

function toNote(row: NoteRow): StoredNote {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    atMs: row.at_ms,
    content: row.content,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastManualEdit: row.last_manual_edit,
  };
}

function prepareStatements(db: RepoContext["db"]) {
  const insertStmt = db.prepare(
    `INSERT INTO meeting_notes (id, meeting_id, at_ms, content, position, created_at, updated_at, last_manual_edit)
     VALUES (@id, @meetingId, @atMs, @content, @position, @at, @at, @at)`,
  );
  const nextPositionStmt = db.prepare<[string], { next: number }>(
    "SELECT COALESCE(MAX(position), 0) + 1 AS next FROM meeting_notes WHERE meeting_id = ?",
  );
  const listStmt = db.prepare<[string], NoteRow>(
    `SELECT n.* FROM meeting_notes n JOIN meetings m ON m.id = n.meeting_id
     WHERE n.meeting_id = ? AND m.deleted_at IS NULL
     ORDER BY n.at_ms IS NULL, n.at_ms, n.position, n.rowid`,
  );
  const getStmt = db.prepare<[string, string], NoteRow>(
    `SELECT n.* FROM meeting_notes n JOIN meetings m ON m.id = n.meeting_id
     WHERE n.id = ? AND n.meeting_id = ? AND m.deleted_at IS NULL`,
  );
  const updateStmt = db.prepare(
    `UPDATE meeting_notes SET content = @content, at_ms = @atMs, updated_at = @at, last_manual_edit = @at
     WHERE id = @id AND meeting_id = @meetingId`,
  );
  const deleteStmt = db.prepare("DELETE FROM meeting_notes WHERE id = ? AND meeting_id = ?");
  const countStmt = db.prepare<[string], { n: number }>(
    "SELECT COUNT(*) AS n FROM meeting_notes WHERE meeting_id = ?",
  );
  const latestStmt = db.prepare<[string], { latest: string | null }>(
    `SELECT MAX(n.updated_at) AS latest FROM meeting_notes n JOIN meetings m ON m.id = n.meeting_id
     WHERE n.meeting_id = ? AND m.deleted_at IS NULL`,
  );
  return {
    insertStmt,
    nextPositionStmt,
    listStmt,
    getStmt,
    updateStmt,
    deleteStmt,
    countStmt,
    latestStmt,
  };
}

/** Hand-typed notes of a meeting. Every read hides notes of soft-deleted meetings. */
export function createMeetingNotesRepository({ db, now, newId }: RepoContext) {
  const {
    insertStmt,
    nextPositionStmt,
    listStmt,
    getStmt,
    updateStmt,
    deleteStmt,
    countStmt,
    latestStmt,
  } = prepareStatements(db);

  function get(meetingId: string, id: string): StoredNote | undefined {
    const row = getStmt.get(id, meetingId);
    return row ? toNote(row) : undefined;
  }

  function insert(input: InsertNoteInput): StoredNote {
    const id = newId();
    insertStmt.run({
      id,
      meetingId: input.meetingId,
      atMs: input.atMs ?? null,
      content: input.content.trim(),
      position: nextPositionStmt.get(input.meetingId)?.next ?? 1,
      at: now(),
    });
    return get(input.meetingId, id) as StoredNote;
  }

  function list(meetingId: string): StoredNote[] {
    return listStmt.all(meetingId).map(toNote);
  }

  /** Returns the updated note, or undefined when the meeting has no such note. */
  function update(meetingId: string, id: string, input: UpdateNoteInput): StoredNote | undefined {
    const current = get(meetingId, id);
    if (!current) return undefined;
    updateStmt.run({
      id,
      meetingId,
      content: input.content === undefined ? current.content : input.content.trim(),
      atMs: input.atMs === undefined ? current.atMs : input.atMs,
      at: now(),
    });
    return get(meetingId, id);
  }

  /** Returns true when a note of that meeting was deleted. */
  const remove = (meetingId: string, id: string): boolean =>
    deleteStmt.run(id, meetingId).changes > 0;

  const count = (meetingId: string): number => countStmt.get(meetingId)?.n ?? 0;

  /** Newest creation / edit time among the meeting's notes (null when none). */
  const latestChangeAt = (meetingId: string): string | null =>
    latestStmt.get(meetingId)?.latest ?? null;

  return { insert, list, get, update, remove, count, latestChangeAt };
}

export type MeetingNotesRepository = ReturnType<typeof createMeetingNotesRepository>;
