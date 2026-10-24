/**
 * The single staleness rule for stored minutes: they are stale when the transcript or the marks
 * changed after the minutes were generated (e.g. the meeting was resumed). A user edit does not
 * refresh `generated_at`, so edited minutes stay stale until regenerated. Deleting a mark leaves
 * no trace and is not detected.
 *
 * `isChangedSince` is the TypeScript form (used per meeting by the minutes service);
 * `minutesStaleSql` is the same rule as a SQL predicate for set-based queries (the meetings list).
 * Both are pinned against each other in `test/meeting-list.test.ts`.
 */
export function isChangedSince(
  generatedAt: string,
  changes: ReadonlyArray<string | null>,
): boolean {
  return changes.some((at) => at !== null && at > generatedAt);
}

/** SQL predicate (0/1) for a row of `minutes` aliased `alias` (needs `meeting_id`, `generated_at`). */
export function minutesStaleSql(alias: string): string {
  const seg = `(SELECT MAX(s.created_at) FROM segments s WHERE s.meeting_id = ${alias}.meeting_id)`;
  const mark = `(SELECT MAX(MAX(k.created_at), MAX(COALESCE(k.updated_at, k.created_at)))
                   FROM marks k WHERE k.meeting_id = ${alias}.meeting_id)`;
  return `(COALESCE(${seg} > ${alias}.generated_at, 0) OR COALESCE(${mark} > ${alias}.generated_at, 0))`;
}
