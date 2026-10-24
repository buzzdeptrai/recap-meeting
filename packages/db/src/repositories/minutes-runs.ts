import type { MinutesLang } from "@recap/core";
import type {
  MinutesRun,
  MinutesRunKind,
  MinutesRunPhase,
  MinutesRunStatus,
  RepoContext,
} from "../types";
import { createMinutesRunsQueue } from "./minutes-runs-queue";
import { toRun, type RunRow } from "./minutes-runs-row";

export interface StartRunInput {
  meetingId: string;
  lang: MinutesLang;
  /** Default `generate`. For `translate`, `lang` is the target language. */
  kind?: MinutesRunKind;
  /** Confirmed replacement of a hand-edited translation. */
  overwrite?: boolean;
  model?: string | null;
  promptVersion?: string | null;
}

export interface RunProgress {
  phase: MinutesRunPhase;
  done: number;
  total: number;
}

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
    `INSERT INTO minutes_runs (id, meeting_id, lang, kind, overwrite, status, model, prompt_version, started_at, updated_at)
     VALUES (@id, @meetingId, @lang, @kind, @overwrite, 'queued', @model, @promptVersion, @at, @at)`,
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
  return {
    getStmt,
    activeStmt,
    latestStmt,
    listActiveStmt,
    insertStmt,
    runningStmt,
    progressStmt,
    endStmt,
  };
}

const insertParams = (id: string, input: StartRunInput, at: string) => ({
  id,
  meetingId: input.meetingId,
  lang: input.lang,
  kind: input.kind ?? "generate",
  overwrite: input.overwrite ? 1 : 0,
  model: input.model ?? null,
  promptVersion: input.promptVersion ?? null,
  at,
});

/**
 * Generation attempts of the minutes. Every mutation is guarded by "still active" so a terminal
 * run (done / failed / cancelled) can never be revived by a late writer, and all of them are safe
 * to repeat.
 */
export function createMinutesRunsRepository(context: RepoContext) {
  const { db, now, newId } = context;
  const {
    getStmt,
    activeStmt,
    latestStmt,
    listActiveStmt,
    insertStmt,
    runningStmt,
    progressStmt,
    endStmt,
  } = prepareStatements(db);

  const get = (id: string): MinutesRun | undefined => {
    const row = getStmt.get(id);
    return row ? toRun(row) : undefined;
  };

  /**
   * Creates a queued run, or returns the active one for the same meeting + language (check its
   * `kind`: a translation into a language blocks generating it, and the other way round).
   */
  function start(input: StartRunInput): { run: MinutesRun; created: boolean } {
    const existing = activeStmt.get(input.meetingId, input.lang);
    if (existing) return { run: toRun(existing), created: false };
    const id = newId();
    insertStmt.run(insertParams(id, input, now()));
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
    ...createMinutesRunsQueue(context),
  };
}

export type MinutesRunsRepository = ReturnType<typeof createMinutesRunsRepository>;
