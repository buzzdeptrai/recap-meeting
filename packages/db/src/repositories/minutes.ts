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
}

function toMinutes(row: MinutesRow): StoredMinutes {
  return {
    meetingId: row.meeting_id,
    lang: row.lang,
    content: minutesContentSchema.parse(JSON.parse(row.content)),
    source: row.source,
    model: row.model,
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
    `INSERT INTO minutes (meeting_id, lang, content, source, model, generated_at, updated_at)
     VALUES (@meetingId, @lang, @content, @source, @model, @at, @at)
     ON CONFLICT (meeting_id, lang) DO UPDATE SET
       content = excluded.content,
       source = excluded.source,
       model = COALESCE(excluded.model, minutes.model),
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
      at: now(),
    });
    return get(input.meetingId, input.lang) as StoredMinutes;
  }

  return { get, upsert };
}

export type MinutesRepository = ReturnType<typeof createMinutesRepository>;
