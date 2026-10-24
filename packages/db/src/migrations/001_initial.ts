export const migration001 = {
  version: 1,
  name: "initial",
  sql: `
CREATE TABLE meetings (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'ended')),
  source_lang TEXT,
  target_lang TEXT,
  agenda      TEXT,
  created_at  TEXT NOT NULL,
  started_at  TEXT,
  ended_at    TEXT,
  duration_ms INTEGER
);
CREATE INDEX idx_meetings_created_at ON meetings (created_at);

CREATE TABLE segments (
  id         TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  channel    INTEGER NOT NULL CHECK (channel IN (0, 1)),
  lang       TEXT,
  start_ms   INTEGER NOT NULL,
  end_ms     INTEGER NOT NULL,
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (meeting_id, seq)
);

CREATE TABLE translations (
  segment_id TEXT NOT NULL REFERENCES segments (id) ON DELETE CASCADE,
  lang       TEXT NOT NULL,
  text       TEXT NOT NULL,
  provider   TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (segment_id, lang)
);

CREATE TABLE marks (
  id         TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  at_ms      INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_marks_meeting ON marks (meeting_id, at_ms);

CREATE TABLE glossary_terms (
  id               TEXT PRIMARY KEY,
  term             TEXT NOT NULL,
  lang             TEXT NOT NULL,
  translation      TEXT,
  do_not_translate INTEGER NOT NULL DEFAULT 0 CHECK (do_not_translate IN (0, 1)),
  priority         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

CREATE TABLE term_variants (
  id      TEXT PRIMARY KEY,
  term_id TEXT NOT NULL REFERENCES glossary_terms (id) ON DELETE CASCADE,
  variant TEXT NOT NULL
);
CREATE INDEX idx_term_variants_term ON term_variants (term_id);
`,
} as const;
