"use client";

import { useCallback, useEffect, useState } from "react";
import type { MinutesLang } from "@recap/core";
import { fetchMinutesRun } from "@/lib/api-minutes";
import { isActiveRun, translatedLangs, translatingInto, type RunsByLang } from "./run-progress";
import { useRunPolling } from "./use-run-polling";

const NO_RUNS: RunsByLang = { vi: null, en: null };

/** Latest run of each language; a failing lookup counts as "no run". */
async function fetchRuns(meetingId: string): Promise<RunsByLang> {
  const [vi, en] = await Promise.all(
    (["vi", "en"] as const).map((lang) => fetchMinutesRun(meetingId, lang).catch(() => null)),
  );
  return { vi: vi ?? null, en: en ?? null };
}

/**
 * Latest run of both languages for the whole minutes page, so any tab knows when the OTHER
 * language is being translated. `refresh` is called when a run ends (a translation is queued
 * just before the source run is marked done); it polls only while something is active.
 */
export function useRunsOverview(meetingId: string, onTranslated: (lang: MinutesLang) => void) {
  const [runs, setRuns] = useState<RunsByLang>(NO_RUNS);

  const refresh = useCallback(async () => setRuns(await fetchRuns(meetingId)), [meetingId]);

  useEffect(() => {
    let cancelled = false;
    fetchRuns(meetingId).then((latest) => !cancelled && setRuns(latest));
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  useEffect(() => {
    for (const lang of translatedLangs(runs)) onTranslated(lang);
  }, [runs, onTranslated]);

  useRunPolling(isActiveRun(runs.vi) || isActiveRun(runs.en), refresh);
  return { translatingInto: translatingInto(runs), refresh };
}
