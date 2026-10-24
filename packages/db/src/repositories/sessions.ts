import type { RepoContext, StoredSession } from "../types";

interface SessionRow {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
  user_agent: string | null;
}

export interface CreateSessionInput {
  id: string;
  userId: string;
  expiresAt: string;
  userAgent?: string | null;
}

const toSession = (row: SessionRow): StoredSession => ({
  id: row.id,
  userId: row.user_id,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  lastSeenAt: row.last_seen_at,
  userAgent: row.user_agent,
});

export function createSessionsRepository({ db, now }: RepoContext) {
  const insertStmt = db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const getStmt = db.prepare<[string], SessionRow>("SELECT * FROM sessions WHERE id = ?");
  const touchStmt = db.prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?");
  const deleteStmt = db.prepare("DELETE FROM sessions WHERE id = ?");
  const deleteUserStmt = db.prepare("DELETE FROM sessions WHERE user_id = ?");
  const deleteOthersStmt = db.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?");
  const expiredStmt = db.prepare("DELETE FROM sessions WHERE expires_at <= ?");

  return {
    create(input: CreateSessionInput): StoredSession {
      const at = now();
      insertStmt.run(input.id, input.userId, at, input.expiresAt, at, input.userAgent ?? null);
      return toSession(getStmt.get(input.id) as SessionRow);
    },
    get(id: string): StoredSession | null {
      const row = getStmt.get(id);
      return row ? toSession(row) : null;
    },
    /** Slides the expiry window and records activity. */
    touch: (id: string, expiresAt: string): void => void touchStmt.run(now(), expiresAt, id),
    delete: (id: string): void => void deleteStmt.run(id),
    deleteForUser: (userId: string): number => deleteUserStmt.run(userId).changes,
    deleteOthersForUser: (userId: string, keepId: string): number =>
      deleteOthersStmt.run(userId, keepId).changes,
    /** Removes sessions whose expiry is at or before `cutoffIso` (default: now). */
    deleteExpired: (cutoffIso: string = now()): number => expiredStmt.run(cutoffIso).changes,
  };
}

export type SessionsRepository = ReturnType<typeof createSessionsRepository>;
