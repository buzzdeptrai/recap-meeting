import { createHash } from "node:crypto";
import type { MarkKind, MinutesContent } from "@recap/core";

/**
 * The staleness rules for stored minutes. Minutes are stale when the transcript or the marks
 * changed after they were generated (timestamps; a user edit does not refresh `generated_at`, so
 * edited minutes stay stale until regenerated), and, by VERSION, when the marks set differs from
 * the one used (a deleted mark leaves no timestamp), or the prompt version / model differ.
 * Stored version fields that are NULL (rows from before versioning) never flag stale.
 *
 * `minutesStaleReasons` is the full per-meeting rule (the minutes service). `isChangedSince` and
 * `minutesStaleSql` are the timestamp-only part, the latter as a SQL predicate for set-based
 * queries (the meetings list, which therefore does not show version-based staleness). The
 * timestamp parts are pinned against each other in `test/meeting-list.test.ts`.
 */
export type StaleReason =
  | "transcript_changed"
  | "marks_changed"
  | "marks_removed"
  | "prompt_updated"
  | "model_changed"
  | "source_edited";

export interface VersionStamp {
  promptVersion: string | null;
  model: string | null;
  marksFingerprint: string | null;
}

export interface StaleInput {
  generatedAt: string;
  latestSegmentAt: string | null;
  latestMarkChangeAt: string | null;
  /** What the minutes were generated with. */
  stored: VersionStamp;
  /** What would be used now; a null field means "unknown" and is not compared. */
  current: VersionStamp;
}

export interface FingerprintMark {
  id: string;
  kind: MarkKind;
  atMs: number;
  label: string | null;
}

/** Stable hash of the set of (id, kind, atMs, label); independent of the order given. */
export function marksFingerprint(marks: readonly FingerprintMark[]): string {
  const rows = marks.map((m) => JSON.stringify([m.id, m.kind, m.atMs, m.label ?? null])).sort();
  return createHash("sha256").update(rows.join("\n")).digest("hex");
}

const differs = (stored: string | null, current: string | null) =>
  stored !== null && current !== null && stored !== current;

/** Why the minutes are stale, in a stable order; empty when fresh. */
export function minutesStaleReasons(input: StaleInput): StaleReason[] {
  const { stored, current } = input;
  const reasons: StaleReason[] = [];
  if (isChangedSince(input.generatedAt, [input.latestSegmentAt]))
    reasons.push("transcript_changed");
  const marksTouched = isChangedSince(input.generatedAt, [input.latestMarkChangeAt]);
  if (marksTouched) reasons.push("marks_changed");
  else if (differs(stored.marksFingerprint, current.marksFingerprint))
    reasons.push("marks_removed");
  if (differs(stored.promptVersion, current.promptVersion)) reasons.push("prompt_updated");
  if (differs(stored.model, current.model)) reasons.push("model_changed");
  return reasons;
}

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

/** Hash of minutes content (as parsed by the schema, so key order is stable). */
export function minutesContentHash(content: MinutesContent): string {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

/**
 * A translation is stale when the source minutes it was made from changed (edited or
 * regenerated). Transcript / marks / prompt / model staleness belongs to the source row only.
 * A translation with no stored hash (or a missing source) is never flagged.
 */
export function derivedStaleReasons(
  storedSourceHash: string | null,
  currentSource: MinutesContent | null,
): StaleReason[] {
  if (storedSourceHash === null || currentSource === null) return [];
  return minutesContentHash(currentSource) === storedSourceHash ? [] : ["source_edited"];
}
