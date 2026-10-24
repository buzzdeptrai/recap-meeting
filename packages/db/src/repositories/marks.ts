import type { MarkKind } from "@recap/core";
import type { RepoContext, StoredMark } from "../types";

interface MarkRow {
  id: string;
  meeting_id: string;
  kind: string;
  at_ms: number;
  label: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface InsertMarkInput {
  meetingId: string;
  kind: MarkKind;
  atMs: number;
  label?: string | null;
}

function toMark(row: MarkRow): StoredMark {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    kind: row.kind as MarkKind,
    atMs: row.at_ms,
    label: row.label,
    createdAt: row.created_at,
  };
}

/** Empty / whitespace-only labels are stored as NULL. */
function normalizeLabel(label: string | null | undefined): string | null {
  const trimmed = label?.trim();
  return trimmed ? trimmed : null;
}

/** Marks of one kind created in [from, to) (ISO instants), across all meetings. */
function createMarkCounter({ db }: Pick<RepoContext, "db">) {
  const countStmt = db.prepare<[string, string, string], { n: number }>(
    "SELECT COUNT(*) AS n FROM marks WHERE kind = ? AND created_at >= ? AND created_at < ?",
  );
  return {
    countByKind: (kind: MarkKind, from: string, to: string): number =>
      countStmt.get(kind, from, to)?.n ?? 0,
  };
}

export function createMarksRepository({ db, now, newId }: RepoContext) {
  const insertStmt = db.prepare(
    `INSERT INTO marks (id, meeting_id, kind, at_ms, label, created_at)
     VALUES (@id, @meetingId, @kind, @atMs, @label, @createdAt)`,
  );
  const listStmt = db.prepare<[string], MarkRow>(
    "SELECT * FROM marks WHERE meeting_id = ? ORDER BY at_ms, rowid",
  );
  const getStmt = db.prepare<[string], MarkRow>("SELECT * FROM marks WHERE id = ?");
  const labelStmt = db.prepare(
    "UPDATE marks SET label = ?, updated_at = ? WHERE id = ? AND meeting_id = ?",
  );
  const latestStmt = db.prepare<[string], { latest: string | null }>(
    "SELECT MAX(MAX(created_at), MAX(COALESCE(updated_at, created_at))) AS latest FROM marks WHERE meeting_id = ?",
  );
  const deleteStmt = db.prepare("DELETE FROM marks WHERE id = ? AND meeting_id = ?");

  function insert(input: InsertMarkInput): StoredMark {
    const mark: StoredMark = {
      ...input,
      label: normalizeLabel(input.label),
      id: newId(),
      createdAt: now(),
    };
    insertStmt.run(mark);
    return mark;
  }

  function list(meetingId: string): StoredMark[] {
    return listStmt.all(meetingId).map(toMark);
  }

  function get(id: string): StoredMark | undefined {
    const row = getStmt.get(id);
    return row ? toMark(row) : undefined;
  }

  /** Sets (or clears, with an empty label) the label. Returns the updated mark, or undefined. */
  function updateLabel(
    meetingId: string,
    id: string,
    label: string | null,
  ): StoredMark | undefined {
    const changes = labelStmt.run(normalizeLabel(label), now(), id, meetingId).changes;
    return changes > 0 ? get(id) : undefined;
  }

  /** Returns true when a mark of that meeting was deleted. */
  function remove(meetingId: string, id: string): boolean {
    return deleteStmt.run(id, meetingId).changes > 0;
  }

  /** Newest creation / rename time among the meeting's marks (null when none). */
  function latestChangeAt(meetingId: string): string | null {
    return latestStmt.get(meetingId)?.latest ?? null;
  }

  return { insert, list, get, updateLabel, remove, latestChangeAt, ...createMarkCounter({ db }) };
}

export type MarksRepository = ReturnType<typeof createMarksRepository>;
