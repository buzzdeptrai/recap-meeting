import type { MinutesProgress, MinutesUsageHook } from "../types";
import type { MinutesWorkerDeps } from "./types";

export type ExecuteDeps = Pick<
  MinutesWorkerDeps,
  "runs" | "minutes" | "repos" | "createLlm" | "createTranslateLlm" | "usage" | "generatorConfig"
>;

/** Writes progress when the step changes (one write per chunk, never per token). */
export function progressWriter(deps: ExecuteDeps, runId: string) {
  let last = "";
  return (progress: MinutesProgress) => {
    const key = `${progress.phase}:${progress.done}:${progress.total}`;
    if (key === last) return;
    last = key;
    try {
      deps.runs.updateProgress(runId, progress);
    } catch {
      // progress is best effort; the run itself must go on
    }
  };
}

export function usageHook(
  deps: ExecuteDeps,
  meetingId: string,
  service: "minutes" | "translate",
): MinutesUsageHook {
  return (event) =>
    deps.usage({
      meetingId,
      vendor: "openai",
      service,
      model: event.model,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      latencyMs: event.latencyMs,
      status: event.status,
      meta: service === "translate" ? { kind: "minutes" } : null,
    });
}

export function failRun(deps: ExecuteDeps, runId: string, message: string) {
  try {
    deps.runs.fail(runId, message);
  } catch {
    // nothing more can be done; the abandoned-run timeout will catch the row
  }
}
