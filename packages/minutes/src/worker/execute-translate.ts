import { minutesContentHash, type MinutesRun } from "@recap/db";
import { MinutesError } from "../errors";
import { TRANSLATE_PROMPT_VERSION } from "../translate-prompts";
import { otherLang, translateMinutes } from "../translate";
import { usageHook, type ExecuteDeps } from "./execute-shared";

/** A hand-edited translation is replaced only when the user confirmed (`run.overwrite`). */
export function isProtectedFromOverwrite(
  existing: { source: "ai" | "edited" } | undefined,
  overwrite: boolean,
): boolean {
  return existing?.source === "edited" && !overwrite;
}

/**
 * Translates the stored source minutes (the other language of `run.lang`) into `run.lang`.
 * The source row is only read; a failure leaves it untouched. Returns false when stopped.
 */
export async function runTranslation(
  deps: ExecuteDeps,
  run: MinutesRun,
  isStopped: () => boolean,
): Promise<boolean> {
  const { meetingId, lang: to } = run;
  const from = otherLang(to);
  if (!deps.createTranslateLlm) throw new MinutesError("Translation is not configured", "CONFIG");
  const source = deps.minutes.get(meetingId, from);
  if (!source) throw new MinutesError("Source minutes not found", "SOURCE_MISSING");
  if (isProtectedFromOverwrite(deps.minutes.get(meetingId, to), run.overwrite)) {
    throw new MinutesError("Translation was edited", "OVERWRITE_PROTECTED");
  }
  const meeting = deps.repos.meetings.get(meetingId);
  if (!meeting) throw new MinutesError("Meeting not found", "MEETING_NOT_FOUND");
  const llm = deps.createTranslateLlm(usageHook(deps, meetingId, "translate"));
  const content = await translateMinutes(
    { meetingTitle: meeting.title, content: source.content, from, to },
    { repos: deps.repos, llm },
  );
  if (isStopped()) return false;
  deps.minutes.upsert({
    meetingId,
    lang: to,
    content,
    source: "ai",
    model: llm.model,
    promptVersion: TRANSLATE_PROMPT_VERSION,
    derivedFromLang: from,
    sourceHash: minutesContentHash(source.content),
  });
  return true;
}
