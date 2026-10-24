import type { MinutesLang } from "@recap/core";
import type { MinutesRun, RepoContext } from "../types";
import { toRun, type RunRow } from "./minutes-runs-row";

const ACTIVE = "status IN ('queued', 'running')";

/** Queue operations of `minutes_runs`; each is one atomic statement. */
export function createMinutesRunsQueue({ db, now }: RepoContext) {
  const staleStmt = db.prepare(
    `UPDATE minutes_runs SET status = 'failed', error = @error, updated_at = @at, finished_at = @at
     WHERE meeting_id = @meetingId AND lang = @lang AND ${ACTIVE} AND updated_at < @cutoff`,
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
    /** Fails active runs of this meeting + language whose last update is older than `cutoff`. */
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
    /** Fails queued runs of this meeting + language nobody claimed since `cutoff`. */
    failUnclaimed: (meetingId: string, lang: MinutesLang, cutoff: string, error: string): number =>
      unclaimedStmt.run({ meetingId, lang, cutoff, error, at: now() }).changes,
  };
}
