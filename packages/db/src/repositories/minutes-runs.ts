import type { MinutesLang } from "@recap/core";
import type { MinutesRun, MinutesRunPhase, MinutesRunStatus, RepoContext } from "../types";

interface RunRow {
  id: string;
  meeting_id: string;
  lang: MinutesLang;
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

export interface StartRunInput {
  meetingId: string;
  lang: MinutesLang;
  model?: string | null;
  promptVersion?: string | null;
}

export interface RunProgress {
  phase: MinutesRunPhase;
  done: number;
  total: number;
}

const toRun = (row: RunRow): MinutesRun => ({
  id: row.id,
  meetingId: row.meeting_id,
  lang: row.lang,
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

const ACTIVE = "status IN ('queued', 'running')";

function prepareStatements(db: RepoContext["db"]) {
  const getStmt = db.prepare<[string], RunRow>("SELECT * FROM minutes_runs WHERE id = ?");
  const activeStmt = db.prepare<[string, string], RunRow>(
    `SELECT * FROM minutes_runs WHERE meeting_id = ? AND lang = ? AND ${ACTIVE}`,
  );
  const latestStmt = db.prepare<[string, string], RunRow>(
    `SELECT * FROM minutes_runs WHERE meeting_id = ? AND lang = ?
     ORDER BY started_at DESC, rowid DESC LIMIT 1`,
  );
  const listActiveStmt = db.prepare<[], RunRow>(
    `SELECT * FROM minutes_runs WHERE ${ACTIVE} ORDER BY started_at, rowid`,
  );
  const insertStmt = db.prepare(
    `INSERT INTO minutes_runs (id, meeting_id, lang, status, model, prompt_version, started_at, updated_at)
     VALUES (@id, @meetingId, @lang, 'queued', @model, @promptVersion, @at, @at)`,
  );
  const runningStmt = db.prepare(
    "UPDATE minutes_runs SET status = 'running', updated_at = ? WHERE id = ? AND status IN ('queued', 'running')",
  );
  const progressStmt = db.prepare(
    `UPDATE minutes_runs SET status = 'running', phase = @phase, done_chunks = @done,
       total_chunks = @total, updated_at = @at WHERE id = @id AND ${ACTIVE}`,
  );
  const endStmt = db.prepare(
    `UPDATE minutes_runs SET status = @status, error = @error, updated_at = @at, finished_at = @at
     WHERE id = @id AND ${ACTIVE}`,
  );
  const staleStmt = db.prepare(
    `UPDATE minutes_runs SET status = 'failed', error = @error, updated_at = @at, finished_at = @at
     WHERE meeting_id = @meetingId AND lang = @lang AND ${ACTIVE} AND updated_at < @cutoff`,
  );
  return {
    getStmt,
    activeStmt,
    latestStmt,
    listActiveStmt,
    insertStmt,
    runningStmt,
    progressStmt,
    endStmt,
    staleStmt,
  };
}

/**
 * Generation attempts of the minutes. Every mutation is guarded by "still active" so a terminal
 * run (done / failed / cancelled) can never be revived by a late writer, and all of them are safe
 * to repeat.
 */
export function createMinutesRunsRepository({ db, now, newId }: RepoContext) {
  const {
    getStmt,
    activeStmt,
    latestStmt,
    listActiveStmt,
    insertStmt,
    runningStmt,
    progressStmt,
    endStmt,
    staleStmt,
  } = prepareStatements(db);

  const get = (id: string): MinutesRun | undefined => {
    const row = getStmt.get(id);
    return row ? toRun(row) : undefined;
  };

  /** Creates a queued run, or returns the active one for the same meeting + language. */
  function start(input: StartRunInput): { run: MinutesRun; created: boolean } {
    const existing = activeStmt.get(input.meetingId, input.lang);
    if (existing) return { run: toRun(existing), created: false };
    const id = newId();
    insertStmt.run({
      id,
      meetingId: input.meetingId,
      lang: input.lang,
      model: input.model ?? null,
      promptVersion: input.promptVersion ?? null,
      at: now(),
    });
    return { run: get(id) as MinutesRun, created: true };
  }

  const end = (status: MinutesRunStatus, id: string, error: string | null): boolean =>
    endStmt.run({ status, id, error, at: now() }).changes > 0;

  return {
    get,
    start,
    latest(meetingId: string, lang: MinutesLang): MinutesRun | undefined {
      const row = latestStmt.get(meetingId, lang);
      return row ? toRun(row) : undefined;
    },
    listActive: (): MinutesRun[] => listActiveStmt.all().map(toRun),
    markRunning: (id: string): boolean => runningStmt.run(now(), id).changes > 0,
    /** False when the run is no longer active (finished, failed, cancelled) and was left untouched. */
    updateProgress: (id: string, p: RunProgress): boolean =>
      progressStmt.run({ id, phase: p.phase, done: p.done, total: p.total, at: now() }).changes > 0,
    finish: (id: string): boolean => end("done", id, null),
    fail: (id: string, error: string): boolean => end("failed", id, error),
    cancel: (id: string): boolean => end("cancelled", id, null),
    /** Fails active runs of this meeting + language whose last update is older than `cutoff`. */
    failStale: (meetingId: string, lang: MinutesLang, cutoff: string, error: string): number =>
      staleStmt.run({ meetingId, lang, cutoff, error, at: now() }).changes,
  };
}

export type MinutesRunsRepository = ReturnType<typeof createMinutesRunsRepository>;
