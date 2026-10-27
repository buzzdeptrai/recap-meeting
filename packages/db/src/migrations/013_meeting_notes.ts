/**
 * Hand-typed meeting notes (backlog B1), stored apart from every AI output.
 * - meeting_notes.at_ms: offset into the meeting (ms); NULL = a note that is not time-stamped.
 * - meeting_notes.position: insertion order, the tiebreaker for equal offsets / untimed notes.
 * - meeting_notes.last_manual_edit: when the owner last typed into the note (AI never writes here).
 * - minutes.notes_fingerprint: hash of the notes the AI minutes were generated with; a different
 *   hash later means the minutes are stale ("notes_changed"). NULL on rows from before.
 */
export const migration013 = {
  version: 13,
  name: "meeting_notes",
  sql: `
CREATE TABLE meeting_notes (
  id               TEXT PRIMARY KEY,
  meeting_id       TEXT NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
  at_ms            INTEGER CHECK (at_ms IS NULL OR at_ms >= 0),
  content          TEXT NOT NULL,
  position         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  last_manual_edit TEXT NOT NULL
);
CREATE INDEX idx_meeting_notes_meeting ON meeting_notes (meeting_id, at_ms);
ALTER TABLE minutes ADD COLUMN notes_fingerprint TEXT;
`,
} as const;
