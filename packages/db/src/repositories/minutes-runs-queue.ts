import type { MinutesLang } from "@recap/core";
import type { MinutesRun, RepoContext } from "../types";
import { toRun, type RunRow } from "./minutes-runs-row";

/** Queue operations of `minutes_runs`; each is one atomic statement. */
export function createMinutesRunsQueue({ db, now }: RepoContext) {
  const staleStmt = db.prepare(
    `UPDATE minutes_runs SET status = 'failed', error = @error, updated_at = @at, finished_at = @at
     WHERE meeting_id = @meetingId AND lang = @lang AND status = 'running' AND updated_at < @cutoff`,
  );
  const activityStmt = db.prepare<[string, string], { alive: number }>(
    `SELECT EXISTS(SELECT 1 FROM minutes_runs WHERE status = 'running' AND updated_at >= ?)
         OR EXISTS(SELECT 1 FROM minutes_runs WHERE status = 'done' AND updated_at >= ?) AS alive`,
  );
  const aheadStmt = db.prepare<{ id: string }, { ahead: number }>(
    `SELECT (SELECT COUNT(*) FROM minutes_runs WHERE status = 'running')
          + (SELECT COUNT(*) FROM minutes_runs q WHERE q.status = 'queued' AND q.id <> @id
               AND (q.started_at, q.rowid) < (SELECT started_at, rowid FROM minutes_runs WHERE id = @id))
            AS ahead`,
  );
  const claimStmt = db.prepare<[string], RunRow>(
    `UPDATE minutes_runs SET status = 'running', updated_at = ?
     WHERE status = 'queued' AND id = (
       SELECT id FROM minutes_runs WHERE status = 'queued' ORDER BY started_at, rowid LIMIT 1
     ) RETURNING *`,
  );
  const failRunningStmt = db.prepare(
    `UPDATE minutes_runs SET status = 'failed', error = @error, updated_at = @at, finished_at = @at
     WHERE status = 'running'`,
  );
  const unclaimedStmt = db.prepare(
    `UPDATE minutes_runs SET status = 'failed', error = @error, updated_at = @at, finished_at = @at
     WHERE meeting_id = @meetingId AND lang = @lang AND status = 'queued' AND updated_at < @cutoff`,
  );
  return {
    /**
     * Fails RUNNING runs of this meeting + language whose last update is older than `cutoff`.
     * Queued runs are never "stale": they wait for a free slot (see `failUnclaimed`).
     */
    failStale: (meetingId: string, lang: MinutesLang, cutoff: string, error: string): number =>
      staleStmt.run({ meetingId, lang, cutoff, error, at: now() }).changes,
    /**
     * Atomically takes the oldest queued run (one conditional UPDATE ... RETURNING, so two
     * workers can never get the same row) and marks it running. Undefined when none is queued.
     */
    claimNext(): MinutesRun | undefined {
      const row = claimStmt.get(now());
      return row ? toRun(row) : undefined;
    },
    /** Startup recovery: runs left 'running' by a process that died. Never requeues. */
    failRunning: (error: string): number => failRunningStmt.run({ error, at: now() }).changes,
    /**
     * True when a worker plausibly lives: a run it executes was updated since `runningSince`
     * (long LLM calls update rarely, so this window is generous) or one it completed since
     * `doneSince`. A queued run behind such activity is waiting its turn, not orphaned.
     */
    hasWorkerActivity: (runningSince: string, doneSince: string): boolean =>
      activityStmt.get(runningSince, doneSince)?.alive === 1,
    /** Runs that will be claimed before this queued one: running ones plus older queued ones. */
    runsAhead: (id: string): number => aheadStmt.get({ id })?.ahead ?? 0,
    /** Fails queued runs of this meeting + language nobody claimed since `cutoff`. */
    failUnclaimed: (meetingId: string, lang: MinutesLang, cutoff: string, error: string): number =>
      unclaimedStmt.run({ meetingId, lang, cutoff, error, at: now() }).changes,
  };
}
