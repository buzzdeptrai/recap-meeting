/**
 * Background minutes generation + version-based staleness.
 * - minutes_runs: one row per generation attempt (progress is read by the UI from here, so it
 *   survives reloads). At most one queued/running run per (meeting, lang) via a partial unique index.
 * - minutes.prompt_version / marks_fingerprint: what the stored minutes were generated with.
 *   Nullable so rows written before this migration stay valid (NULL = unknown, never flagged stale).
 */
export const migration010 = {
  version: 10,
  name: "minutes_runs",
  sql: `
CREATE TABLE minutes_runs (
  id            TEXT PRIMARY KEY,
  meeting_id    TEXT NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
  lang          TEXT NOT NULL CHECK (lang IN ('vi', 'en')),
  status        TEXT NOT NULL CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  total_chunks  INTEGER NOT NULL DEFAULT 0,
  done_chunks   INTEGER NOT NULL DEFAULT 0,
  phase         TEXT CHECK (phase IS NULL OR phase IN ('map', 'reduce', 'finalize')),
  error         TEXT,
  model         TEXT,
  prompt_version TEXT,
  started_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  finished_at   TEXT
);
CREATE INDEX idx_minutes_runs_meeting_lang ON minutes_runs (meeting_id, lang, started_at);
CREATE INDEX idx_minutes_runs_status_updated ON minutes_runs (status, updated_at);
CREATE UNIQUE INDEX uq_minutes_runs_active ON minutes_runs (meeting_id, lang)
  WHERE status IN ('queued', 'running');

ALTER TABLE minutes ADD COLUMN prompt_version TEXT;
ALTER TABLE minutes ADD COLUMN marks_fingerprint TEXT;
`,
} as const;
