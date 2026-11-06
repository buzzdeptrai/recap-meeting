/**
 * Per-user ownership of meetings.
 * - meetings.owner_id: the user who created the meeting (REST create stores the session user).
 *   Members see only their own meetings; admins see all. NULL = no owner (visible to admins
 *   only). No ON DELETE action: users are disabled, not deleted, and a plain reference keeps
 *   the column safe to add on an existing table.
 * - Backfill: every existing meeting (soft-deleted ones included) goes to the earliest-created
 *   admin; ties on created_at break on rowid, then id. With no admin the column stays NULL.
 */
export const migration015 = {
  version: 15,
  name: "meeting_owner",
  sql: `
ALTER TABLE meetings ADD COLUMN owner_id TEXT REFERENCES users(id);
CREATE INDEX idx_meetings_owner ON meetings (owner_id, created_at);
UPDATE meetings SET owner_id = (
  SELECT id FROM users WHERE role = 'admin' ORDER BY created_at, rowid, id LIMIT 1
);
`,
} as const;
