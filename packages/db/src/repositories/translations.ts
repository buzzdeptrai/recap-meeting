import type { TargetLang } from "@recap/core";
import type { RepoContext, Translation } from "../types";

interface TranslationRow {
  segment_id: string;
  lang: string;
  text: string;
  provider: string;
  latency_ms: number;
  created_at: string;
}

export interface UpsertTranslationInput {
  segmentId: string;
  lang: TargetLang;
  text: string;
  provider: string;
  latencyMs: number;
}

function toTranslation(row: TranslationRow): Translation {
  return {
    segmentId: row.segment_id,
    lang: row.lang as TargetLang,
    text: row.text,
    provider: row.provider,
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
  };
}

export function createTranslationsRepository({ db, now }: RepoContext) {
  const upsertStmt = db.prepare(
    `INSERT INTO translations (segment_id, lang, text, provider, latency_ms, created_at)
     VALUES (@segmentId, @lang, @text, @provider, @latencyMs, @createdAt)
     ON CONFLICT (segment_id, lang) DO UPDATE SET
       text = excluded.text, provider = excluded.provider,
       latency_ms = excluded.latency_ms, created_at = excluded.created_at`,
  );
  const listStmt = db.prepare<[string], TranslationRow>(
    `SELECT t.* FROM translations t JOIN segments s ON s.id = t.segment_id
     WHERE s.meeting_id = ? ORDER BY s.seq, t.lang`,
  );

  const rangeStmt = db.prepare<[string, number, number], TranslationRow>(
    `SELECT t.* FROM translations t JOIN segments s ON s.id = t.segment_id
     WHERE s.meeting_id = ? AND s.seq BETWEEN ? AND ? ORDER BY s.seq, t.lang`,
  );

  function upsert(input: UpsertTranslationInput): Translation {
    const translation: Translation = {
      ...input,
      latencyMs: Math.round(input.latencyMs),
      createdAt: now(),
    };
    upsertStmt.run(translation);
    return translation;
  }

  function listByMeeting(meetingId: string): Translation[] {
    return listStmt.all(meetingId).map(toTranslation);
  }

  /** Translations of the segments with `fromSeq <= seq <= toSeq` (one page of the transcript). */
  function listBySeqRange(meetingId: string, fromSeq: number, toSeq: number): Translation[] {
    return rangeStmt.all(meetingId, fromSeq, toSeq).map(toTranslation);
  }

  return { upsert, listByMeeting, listBySeqRange };
}

export type TranslationsRepository = ReturnType<typeof createTranslationsRepository>;
