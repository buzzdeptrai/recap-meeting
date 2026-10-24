import type { MinutesRunPhase } from "@recap/db";
import type { MinutesRunDto } from "@/lib/api-types";

export const POLL_INTERVAL_MS = 2_000;

export const PHASE_LABEL: Record<MinutesRunPhase, string> = {
  map: "Đọc từng đoạn",
  reduce: "Gộp ý chính",
  finalize: "Hoàn thiện",
};
const PREPARING_LABEL = "Đang chuẩn bị";
/** Queued: waiting for the background worker to pick the run up. */
const WAITING_LABEL = "Đang chờ xử lý";
/** Steps besides the chunks: the merge and the final pass. */
const EXTRA_STEPS = 2;

export const isActiveRun = (run: MinutesRunDto | null): boolean =>
  run !== null && (run.status === "queued" || run.status === "running");

export interface RunProgressView {
  label: string;
  /** 1-based step being worked on. */
  step: number;
  steps: number;
  percent: number;
}

/** Steps completed: chunks read, then the merge, then the final pass. */
function completedSteps(run: MinutesRunDto, chunks: number): number {
  if (run.phase === "reduce") return chunks;
  if (run.phase === "finalize") return chunks + 1;
  return run.phase === "map" ? Math.min(run.done, chunks) : 0;
}

function labelOf(run: MinutesRunDto | null): string {
  if (run?.phase) return PHASE_LABEL[run.phase];
  return run?.status === "queued" ? WAITING_LABEL : PREPARING_LABEL;
}

/** What the progress card shows for a run (or for the moment before the first answer). */
export function runProgressView(run: MinutesRunDto | null): RunProgressView {
  const chunks = Math.max(run?.total ?? 0, 1);
  const steps = chunks + EXTRA_STEPS;
  const completed = run ? completedSteps(run, chunks) : 0;
  return {
    label: labelOf(run),
    step: Math.min(completed + 1, steps),
    steps,
    percent: Math.min(100, Math.round((completed / steps) * 100)),
  };
}

/** Poll only while a run is active and the tab can be seen (no wasted requests in the background). */
export const shouldPoll = (active: boolean, tabVisible: boolean): boolean => active && tabVisible;

/**
 * A failed / cancelled run the user has not resolved yet: it ended after the stored minutes were
 * generated (or there are no minutes), so a later successful run has not replaced it.
 */
export function hasUnresolvedFailure(
  run: MinutesRunDto,
  minutesGeneratedAt: string | null,
): boolean {
  if (run.status !== "failed" && run.status !== "cancelled") return false;
  if (minutesGeneratedAt === null || run.finishedAt === null) return true;
  return run.finishedAt > minutesGeneratedAt;
}
