import type { MinutesRun } from "@recap/db";
import { generateMinutes } from "../generate";
import { GENERIC_RUN_ERROR, GENERIC_TRANSLATE_ERROR, safeFailureMessage } from "./messages";
import { failRun, progressWriter, usageHook, type ExecuteDeps } from "./execute-shared";
import { runTranslation } from "./execute-translate";
import { queueTranslationAfterGenerate } from "./follow-up";

const generatorOverrides = (deps: ExecuteDeps) =>
  typeof deps.generatorConfig === "function" ? deps.generatorConfig() : deps.generatorConfig;

/** Generates the source minutes, stores them, queues the translation. False when stopped. */
async function runGeneration(
  deps: ExecuteDeps,
  run: MinutesRun,
  isStopped: () => boolean,
  log: (message: string) => void,
): Promise<boolean> {
  const { id, meetingId, lang } = run;
  const result = await generateMinutes(
    { meetingId, lang },
    {
      repos: deps.repos,
      llm: deps.createLlm(usageHook(deps, meetingId, "minutes")),
      config: generatorOverrides(deps),
      onProgress: progressWriter(deps, id),
    },
  );
  if (isStopped()) return false;
  deps.minutes.upsert({
    meetingId,
    lang,
    content: result.content,
    source: "ai",
    model: result.model,
    promptVersion: result.promptVersion,
    marksFingerprint: result.marksFingerprint,
    notesFingerprint: result.notesFingerprint,
    derivedFromLang: null,
    sourceHash: null,
  });
  // Queued before the source run is marked done, so the UI finds it as soon as it sees "done".
  queueTranslationAfterGenerate(deps, meetingId, lang, log);
  return true;
}

/**
 * Runs one claimed run (generate or translate) to a terminal state. `isStopped` turns every late
 * write into a no-op once the worker shut down (the run was already failed with the restart
 * message).
 */
export async function executeRun(
  deps: ExecuteDeps,
  run: MinutesRun,
  isStopped: () => boolean,
  log: (message: string) => void,
): Promise<void> {
  const translate = run.kind === "translate";
  try {
    const completed = translate
      ? await runTranslation(deps, run, isStopped)
      : await runGeneration(deps, run, isStopped, log);
    if (completed) deps.runs.finish(run.id);
  } catch (err) {
    // Log the kind only: client errors may carry request details.
    log(`[minutes-worker] run failed: ${err instanceof Error ? err.name : "unknown"}`);
    if (!isStopped()) failRun(deps, run.id, safeFailureMessage(err, run.kind));
  } finally {
    // Never leave a row active after the job is over (no-op once terminal).
    failRun(deps, run.id, translate ? GENERIC_TRANSLATE_ERROR : GENERIC_RUN_ERROR);
  }
}
