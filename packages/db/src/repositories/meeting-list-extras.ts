import type { MinutesLang, MinutesSource } from "@recap/core";
import type { RepoContext } from "../types";
import { minutesStaleSql } from "./minutes-staleness";

export interface MinutesBadge {
  source: MinutesSource;
  stale: boolean;
}

export type MinutesBadges = Partial<Record<MinutesLang, MinutesBadge>>;

export interface MeetingExtras {
  topicCount: number;
  conclusionCount: number;
  wordCount: number;
  minutes: MinutesBadges;
  firstConclusion?: string;
}

const MAX_PREVIEW = 160;

/** First non-empty line of the agenda (bullet markers dropped), shortened. */
export function agendaPreview(agenda: string | null): string | undefined {
  for (const line of (agenda ?? "").split(/\r?\n/)) {
    const text = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (text) return text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW - 1)}…` : text;
  }
  return undefined;
}

const placeholders = (ids: string[]) => ids.map(() => "?").join(",");

type Apply<R> = (extra: MeetingExtras, row: R) => void;

/**
 * Per-meeting counters for one page of the list: a handful of grouped queries over
 * `meeting_id IN (page ids)`, never one query per row.
 */
export function loadMeetingExtras({ db }: RepoContext, ids: string[]): Map<string, MeetingExtras> {
  const out = new Map<string, MeetingExtras>();
  if (ids.length === 0) return out;
  for (const id of ids)
    out.set(id, { topicCount: 0, conclusionCount: 0, wordCount: 0, minutes: {} });
  const marks = placeholders(ids);
  const run = <R extends { id: string }>(sql: string, apply: Apply<R>) => {
    for (const row of db.prepare<string[], R>(sql).all(...ids))
      apply(out.get(row.id) as MeetingExtras, row);
  };

  run<{ id: string; n: number }>(
    `SELECT meeting_id AS id,
            SUM(CASE WHEN trim(text) = '' THEN 0
                     ELSE length(trim(text)) - length(replace(trim(text), ' ', '')) + 1 END) AS n
       FROM segments WHERE meeting_id IN (${marks}) GROUP BY meeting_id`,
    (extra, row) => void (extra.wordCount = row.n),
  );
  run<{ id: string; topics: number; conclusions: number }>(
    `SELECT meeting_id AS id, SUM(kind = 'topic') AS topics, SUM(kind = 'conclusion') AS conclusions
       FROM marks WHERE meeting_id IN (${marks}) GROUP BY meeting_id`,
    (extra, row) => {
      extra.topicCount = row.topics;
      extra.conclusionCount = row.conclusions;
    },
  );
  run<{ id: string; label: string }>(
    `SELECT meeting_id AS id, label FROM marks
      WHERE kind = 'conclusion' AND label IS NOT NULL AND meeting_id IN (${marks})
      ORDER BY at_ms, rowid`,
    (extra, row) => void (extra.firstConclusion ??= row.label),
  );
  run<{ id: string; lang: MinutesLang; source: MinutesSource; stale: number }>(
    `SELECT mi.meeting_id AS id, mi.lang AS lang, mi.source AS source,
            ${minutesStaleSql("mi")} AS stale
       FROM minutes mi WHERE mi.meeting_id IN (${marks})`,
    (extra, row) => void (extra.minutes[row.lang] = { source: row.source, stale: row.stale === 1 }),
  );
  return out;
}
