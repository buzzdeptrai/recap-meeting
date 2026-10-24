export const migration002 = {
  version: 2,
  name: "minutes",
  sql: `
CREATE TABLE minutes (
  meeting_id   TEXT NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
  lang         TEXT NOT NULL CHECK (lang IN ('vi', 'en')),
  content      TEXT NOT NULL,
  source       TEXT NOT NULL CHECK (source IN ('ai', 'edited')),
  model        TEXT,
  generated_at TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (meeting_id, lang)
);
`,
} as const;
