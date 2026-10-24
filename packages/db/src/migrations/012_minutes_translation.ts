/**
 * Derived (translated) minutes. Minutes are generated once in a source language; the other
 * language is translated from them automatically.
 * - minutes.derived_from_lang: set on a row that is a translation of the other language's row
 *   (NULL = a source row; every row from before this migration stays a source row).
 * - minutes.source_hash: hash of the source content that was translated; a different hash of the
 *   source row later means the translation is stale ("source_edited").
 * - minutes_runs.kind: 'generate' (default, source minutes) or 'translate' (lang = target language).
 * - minutes_runs.overwrite: 1 when the user confirmed replacing a hand-edited translation.
 */
export const migration012 = {
  version: 12,
  name: "minutes_translation",
  sql: `
ALTER TABLE minutes ADD COLUMN derived_from_lang TEXT
  CHECK (derived_from_lang IS NULL OR derived_from_lang IN ('vi', 'en'));
ALTER TABLE minutes ADD COLUMN source_hash TEXT;
ALTER TABLE minutes_runs ADD COLUMN kind TEXT NOT NULL DEFAULT 'generate'
  CHECK (kind IN ('generate', 'translate'));
ALTER TABLE minutes_runs ADD COLUMN overwrite INTEGER NOT NULL DEFAULT 0;
`,
} as const;
