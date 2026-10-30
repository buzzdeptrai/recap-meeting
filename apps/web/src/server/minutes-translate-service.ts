import type { MinutesLang } from "@recap/core";
import { TRANSLATE_PROMPT_VERSION, otherLang } from "@recap/minutes";
import type { MinutesRunDto } from "@/lib/api-types";
import {
  failAbandoned,
  defaultRunDeps,
  runsAhead,
  toRunDto,
  type MinutesRunDeps,
} from "./minutes-run-service";
import { requireEndedMeeting } from "./minutes-service";
import { ServiceError } from "./service-error";

export interface TranslateOptions {
  /** The user confirmed replacing a hand-edited version of the target language. */
  confirmOverwrite?: boolean;
}

/**
 * Enqueues a (re-)translation into `target` from the other language's stored minutes. Preconditions
 * fail synchronously: the source minutes must exist, and a hand-edited target is only replaced
 * with an explicit confirmation (409 DERIVED_EDITED otherwise; never a silent overwrite).
 */
export function startTranslationRun(
  meetingId: string,
  target: MinutesLang,
  options: TranslateOptions = {},
  deps: MinutesRunDeps = defaultRunDeps(),
): MinutesRunDto {
  requireEndedMeeting(deps.repos, meetingId);
  if (!deps.repos.minutes.get(meetingId, otherLang(target))) {
    throw new ServiceError(409, "SOURCE_MISSING", "Chưa có biên bản gốc để dịch.");
  }
  const existing = deps.repos.minutes.get(meetingId, target);
  if (existing?.source === "edited" && !options.confirmOverwrite) {
    throw new ServiceError(
      409,
      "DERIVED_EDITED",
      "Bản này đã được bạn chỉnh sửa. Dịch lại sẽ ghi đè các chỉnh sửa.",
    );
  }
  deps.requireModel();
  failAbandoned(deps, meetingId, target);
  const { run } = deps.repos.minutesRuns.start({
    meetingId,
    lang: target,
    kind: "translate",
    overwrite: options.confirmOverwrite === true,
    promptVersion: TRANSLATE_PROMPT_VERSION,
  });
  if (run.kind !== "translate") {
    throw new ServiceError(409, "RUN_BUSY", "Biên bản ngôn ngữ này đang được tạo. Hãy đợi xong.");
  }
  return toRunDto(run, runsAhead(deps, run));
}
