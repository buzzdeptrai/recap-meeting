/**
 * Soft delete for meetings: `deleted_at` (ISO time) marks a meeting as removed from every list,
 * search, count and room route while ALL its data stays (segments, translations, minutes, marks,
 * audio files, usage_events), so it can be restored. `deleted_by` is the user id (informational,
 * no foreign key so removing a user never touches meetings). FTS triggers are untouched: list and
 * search queries filter on `deleted_at` instead.
 * - partial index serves the "Đã xóa gần đây" list (newest deletion first).
 */
export const migration011 = {
  version: 11,
  name: "meeting_soft_delete",
  sql: `
ALTER TABLE meetings ADD COLUMN deleted_at TEXT;
ALTER TABLE meetings ADD COLUMN deleted_by TEXT;
CREATE INDEX idx_meetings_deleted_at ON meetings (deleted_at) WHERE deleted_at IS NOT NULL;
`,
} as const;
