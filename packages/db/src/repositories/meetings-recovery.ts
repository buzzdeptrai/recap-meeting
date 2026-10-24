import type { RepoContext } from "../types";

/** Audio length of a meeting that only the caller can measure (WAV file); undefined = unknown. */
export type RecordedMsLookup = (meetingId: string) => number | undefined;

interface LiveRow {
  id: string;
  last_segment_at: string | null;
  max_end_ms: number | null;
}

/**
 * Closes meetings left `live` by a process that died without calling `end()`. Call it only while
 * no session can be running: the system has exactly one realtime process per database, so at its
 * boot every `live` row is by definition orphaned.
 *
 * - ended_at = created_at of the meeting's last segment, else `nowIso` (nothing was transcribed,
 *   so the boot time is the first moment we know it is over).
 * - duration_ms = recorded audio length when `recordedMsFor` knows it (same meaning as `end()`
 *   for resumed meetings), else the greatest segment end_ms, else 0. Wall clock is NOT used:
 *   after a crash it would include the downtime.
 * - Soft-deleted rows are ignored (they cannot be live: soft delete refuses live meetings).
 * - Idempotent: the UPDATE re-checks status = 'live', and a second run finds nothing.
 *
 * Returns the recovered ids.
 */
function recoverLiveMeetings(
  ctx: RepoContext,
  nowIso: string = ctx.now(),
  recordedMsFor?: RecordedMsLookup,
): string[] {
  const { db } = ctx;
  const select = db.prepare<[], LiveRow>(
    `SELECT m.id AS id, MAX(s.created_at) AS last_segment_at, MAX(s.end_ms) AS max_end_ms
     FROM meetings m LEFT JOIN segments s ON s.meeting_id = m.id
     WHERE m.status = 'live' AND m.deleted_at IS NULL
     GROUP BY m.id ORDER BY m.rowid`,
  );
  const update = db.prepare(
    `UPDATE meetings SET status = 'ended', ended_at = ?, duration_ms = ?
     WHERE id = ? AND status = 'live'`,
  );
  return db.transaction((): string[] => {
    const recovered: string[] = [];
    for (const row of select.all()) {
      const recordedMs = recordedMsFor?.(row.id);
      const durationMs = Math.max(0, Math.round(recordedMs ?? row.max_end_ms ?? 0));
      const changes = update.run(row.last_segment_at ?? nowIso, durationMs, row.id).changes;
      if (changes > 0) recovered.push(row.id);
    }
    return recovered;
  })();
}

export function createMeetingRecovery(ctx: RepoContext) {
  return {
    recoverLive: (nowIso?: string, recordedMsFor?: RecordedMsLookup) =>
      recoverLiveMeetings(ctx, nowIso, recordedMsFor),
  };
}
