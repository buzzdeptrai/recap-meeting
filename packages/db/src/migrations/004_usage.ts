export const migration004 = {
  version: 4,
  name: "usage_events",
  sql: `
CREATE TABLE usage_events (
  id            TEXT PRIMARY KEY,
  ts            TEXT NOT NULL,
  meeting_id    TEXT REFERENCES meetings (id) ON DELETE SET NULL,
  vendor        TEXT NOT NULL CHECK (vendor IN ('deepgram', 'gemini', 'openai', 'assemblyai')),
  service       TEXT NOT NULL CHECK (service IN ('stt_live', 'translate', 'minutes', 'stt_batch')),
  model         TEXT NOT NULL,
  audio_seconds REAL,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  requests      INTEGER NOT NULL DEFAULT 1,
  latency_ms    INTEGER,
  status        TEXT NOT NULL CHECK (status IN ('ok', 'error', 'fallback')),
  cost_usd      REAL,
  meta          TEXT
);
CREATE INDEX idx_usage_events_ts ON usage_events (ts);
CREATE INDEX idx_usage_events_vendor ON usage_events (vendor, ts);
CREATE INDEX idx_usage_events_meeting ON usage_events (meeting_id);
`,
} as const;
