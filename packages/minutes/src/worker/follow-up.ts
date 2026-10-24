import { otherLang } from "../translate";
import { isProtectedFromOverwrite } from "./execute-translate";
import type { ExecuteDeps } from "./execute-shared";

/**
 * After source minutes were stored: queue the translation into the other language, in the same
 * queue. Skipped when translation is not configured or the other language holds a hand-edited
 * version (that one needs an explicit confirmation from the user, never an automatic overwrite).
 * Never throws: source minutes are already usable and must be marked done regardless.
 */
export function queueTranslationAfterGenerate(
  deps: ExecuteDeps,
  meetingId: string,
  sourceLang: "vi" | "en",
  log: (message: string) => void,
): void {
  if (!deps.createTranslateLlm) return;
  const target = otherLang(sourceLang);
  try {
    if (isProtectedFromOverwrite(deps.minutes.get(meetingId, target), false)) return;
    deps.runs.start({ meetingId, lang: target, kind: "translate" });
  } catch (err) {
    log(
      `[minutes-worker] could not queue translation: ${err instanceof Error ? err.name : "unknown"}`,
    );
  }
}
