import {
  minutesContentSchema,
  type MinutesContent,
  type MinutesLang,
  type MinutesSource,
} from "@recap/core";
import type { RepoContext, StoredMinutes } from "../types";

interface MinutesRow {
  meeting_id: string;
  lang: MinutesLang;
  content: string;
  source: MinutesSource;
  model: string | null;
  prompt_version: string | null;
  marks_fingerprint: string | null;
  notes_fingerprint: string | null;
  derived_from_lang: MinutesLang | null;
  source_hash: string | null;
  generated_at: string;
  updated_at: string;
}

export interface UpsertMinutesInput {
  meetingId: string;
  lang: MinutesLang;
  content: MinutesContent;
  source: MinutesSource;
  /** Model that produced an `ai` version; kept as-is when a user edit is saved without one. */
  model?: string | null;
  /** Version stamps of an `ai` version; ignored (kept as stored) for user edits. */
  promptVersion?: string | null;
  marksFingerprint?: string | null;
  notesFingerprint?: string | null;
  /** Translation provenance of an `ai` version; kept as stored for user edits. */
  derivedFromLang?: MinutesLang | null;
  sourceHash?: string | null;
}

function toMinutes(row: MinutesRow): StoredMinutes {
  return {
    meetingId: row.meeting_id,
    lang: row.lang,
    content: minutesContentSchema.parse(JSON.parse(row.content)),
    source: row.source,
    model: row.model,
    promptVersion: row.prompt_version,
    marksFingerprint: row.marks_fingerprint,
    notesFingerprint: row.notes_fingerprint,
    derivedFromLang: row.derived_from_lang,
    sourceHash: row.source_hash,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

export function createMinutesRepository({ db, now }: RepoContext) {
  const getStmt = db.prepare<[string, string], MinutesRow>(
    "SELECT * FROM minutes WHERE meeting_id = ? AND lang = ?",
  );
  // generated_at changes only when the AI regenerates; an edit just bumps updated_at.
  const upsertStmt = db.prepare(
    `INSERT INTO minutes (meeting_id, lang, content, source, model, prompt_version, marks_fingerprint, notes_fingerprint, derived_from_lang, source_hash, generated_at, updated_at)
     VALUES (@meetingId, @lang, @content, @source, @model, @promptVersion, @marksFingerprint, @notesFingerprint, @derivedFromLang, @sourceHash, @at, @at)
     ON CONFLICT (meeting_id, lang) DO UPDATE SET
       content = excluded.content,
       source = excluded.source,
       model = COALESCE(excluded.model, minutes.model),
       prompt_version = CASE WHEN excluded.source = 'ai' THEN excluded.prompt_version
                             ELSE minutes.prompt_version END,
       marks_fingerprint = CASE WHEN excluded.source = 'ai' THEN excluded.marks_fingerprint
                                ELSE minutes.marks_fingerprint END,
       notes_fingerprint = CASE WHEN excluded.source = 'ai' THEN excluded.notes_fingerprint
                                ELSE minutes.notes_fingerprint END,
       derived_from_lang = CASE WHEN excluded.source = 'ai' THEN excluded.derived_from_lang
                                ELSE minutes.derived_from_lang END,
       source_hash = CASE WHEN excluded.source = 'ai' THEN excluded.source_hash
                          ELSE minutes.source_hash END,
       generated_at = CASE WHEN excluded.source = 'ai' THEN excluded.generated_at
                           ELSE minutes.generated_at END,
       updated_at = excluded.updated_at`,
  );

  function get(meetingId: string, lang: MinutesLang): StoredMinutes | undefined {
    const row = getStmt.get(meetingId, lang);
    return row ? toMinutes(row) : undefined;
  }

  function upsert(input: UpsertMinutesInput): StoredMinutes {
    const content = minutesContentSchema.parse(input.content);
    upsertStmt.run({
      meetingId: input.meetingId,
      lang: input.lang,
      content: JSON.stringify(content),
      source: input.source,
      model: input.model ?? null,
      promptVersion: input.promptVersion ?? null,
      marksFingerprint: input.marksFingerprint ?? null,
      notesFingerprint: input.notesFingerprint ?? null,
      derivedFromLang: input.derivedFromLang ?? null,
      sourceHash: input.sourceHash ?? null,
      at: now(),
    });
    return get(input.meetingId, input.lang) as StoredMinutes;
  }

  return { get, upsert };
}

export type MinutesRepository = ReturnType<typeof createMinutesRepository>;
