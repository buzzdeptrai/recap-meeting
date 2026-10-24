import type { MinutesRun } from "@recap/db";
import { generateMinutes } from "../generate";
import type { MinutesProgress, MinutesUsageHook } from "../types";
import { GENERIC_RUN_ERROR, safeFailureMessage } from "./messages";
import type { MinutesWorkerDeps } from "./types";

type ExecuteDeps = Pick<
  MinutesWorkerDeps,
  "runs" | "minutes" | "repos" | "createLlm" | "usage" | "generatorConfig"
>;

/** Writes progress when the step changes (one write per chunk, never per token). */
function progressWriter(deps: ExecuteDeps, runId: string) {
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

function usageHook(deps: ExecuteDeps, meetingId: string): MinutesUsageHook {
  return (event) =>
    deps.usage({
      meetingId,
      vendor: "openai",
      service: "minutes",
      model: event.model,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      latencyMs: event.latencyMs,
      status: event.status,
    });
}

function failRun(deps: ExecuteDeps, runId: string, message: string) {
  try {
    deps.runs.fail(runId, message);
  } catch {
    // nothing more can be done; the abandoned-run timeout will catch the row
  }
}

const generatorOverrides = (deps: ExecuteDeps) =>
  typeof deps.generatorConfig === "function" ? deps.generatorConfig() : deps.generatorConfig;

/**
 * Runs one claimed run to a terminal state. `isStopped` turns every late write into a no-op once
 * the worker shut down (the run was already failed with the restart message).
 */
export async function executeRun(
  deps: ExecuteDeps,
  run: MinutesRun,
  isStopped: () => boolean,
  log: (message: string) => void,
): Promise<void> {
  const { id, meetingId, lang } = run;
  try {
    const result = await generateMinutes(
      { meetingId, lang },
      {
        repos: deps.repos,
        llm: deps.createLlm(usageHook(deps, meetingId)),
        config: generatorOverrides(deps),
        onProgress: progressWriter(deps, id),
      },
    );
    if (isStopped()) return;
    deps.minutes.upsert({
      meetingId,
      lang,
      content: result.content,
      source: "ai",
      model: result.model,
      promptVersion: result.promptVersion,
      marksFingerprint: result.marksFingerprint,
    });
    deps.runs.finish(id);
  } catch (err) {
    // Log the kind only: client errors may carry request details.
    log(`[minutes-worker] run failed: ${err instanceof Error ? err.name : "unknown"}`);
    if (!isStopped()) failRun(deps, id, safeFailureMessage(err));
  } finally {
    // Never leave a row active after the job is over (no-op once terminal).
    failRun(deps, id, GENERIC_RUN_ERROR);
  }
}
