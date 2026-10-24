import type { MinutesLang } from "@recap/core";
import type { MinutesRun, MinutesRunKind, MinutesRunPhase, MinutesRunStatus } from "../types";

export interface RunRow {
  id: string;
  meeting_id: string;
  lang: MinutesLang;
  kind: MinutesRunKind;
  overwrite: number;
  status: MinutesRunStatus;
  total_chunks: number;
  done_chunks: number;
  phase: MinutesRunPhase | null;
  error: string | null;
  model: string | null;
  prompt_version: string | null;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
}

export const toRun = (row: RunRow): MinutesRun => ({
  id: row.id,
  meetingId: row.meeting_id,
  lang: row.lang,
  kind: row.kind,
  overwrite: row.overwrite === 1,
  status: row.status,
  totalChunks: row.total_chunks,
  doneChunks: row.done_chunks,
  phase: row.phase,
  error: row.error,
  model: row.model,
  promptVersion: row.prompt_version,
  startedAt: row.started_at,
  updatedAt: row.updated_at,
  finishedAt: row.finished_at,
});
