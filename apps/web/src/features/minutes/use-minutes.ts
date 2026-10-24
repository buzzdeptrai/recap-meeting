"use client";

import type { MinutesContent, MinutesLang } from "@recap/core";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  fetchMinutes,
  fetchMinutesRun,
  saveMinutes,
  startMinutesRun,
  startMinutesTranslation,
} from "@/lib/api-minutes";
import type { MinutesDto, MinutesRunDto } from "@/lib/api-types";
import { EMPTY_CONTENT, editReducer, type EditAction } from "./edit-reducer";
import { describeMinutesError, type MinutesAction } from "./error-copy";
import { prepareForSave } from "./prepare-save";
import { hasUnresolvedFailure, isActiveRun } from "./run-progress";
import { useRunPolling } from "./use-run-polling";

export type MinutesPhase = "loading" | "empty" | "generating" | "ready" | "load-error";

interface Failure {
  action: MinutesAction;
  message: string;
}

/**
 * Loads, generates, translates, edits and saves the minutes of one meeting in one language.
 * The caller remounts it (via `key`) when the language changes, so state never mixes languages.
 * `onStartedIn` is called when a generation was started for ANOTHER source language (the caller
 * then shows that language, where the run is watched).
 */
export function useMinutes(
  meetingId: string,
  lang: MinutesLang,
  onStartedIn: (lang: MinutesLang) => void,
) {
  const [phase, setPhase] = useState<MinutesPhase>("loading");
  const [saved, setSaved] = useState<MinutesDto | null>(null);
  const [content, dispatch] = useReducer(editReducer, EMPTY_CONTENT);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [run, setRun] = useState<MinutesRunDto | null>(null);

  const apply = useCallback((dto: MinutesDto) => {
    setSaved(dto);
    dispatch({ type: "reset", content: dto.content });
    setPhase("ready");
  }, []);

  const sinks = { apply, setPhase, setFailure, setRun };
  useLoadMinutes({ meetingId, lang, attempt }, sinks);
  useRunWatcher({ meetingId, lang, run, hasSaved: saved !== null }, sinks);

  const reload = () => {
    setFailure(null);
    setPhase("loading");
    setAttempt((n) => n + 1);
  };
  const actions = useMinutesActions(
    { meetingId, lang, content, hasSaved: saved !== null, onStartedIn },
    sinks,
  );
  const dirty = useDirty(phase, saved?.content ?? null, content);
  useUnsavedGuard(dirty);

  return {
    phase,
    saved,
    run,
    content,
    edit: dispatch as (action: EditAction) => void,
    dirty,
    failure,
    reload,
    dismissFailure: () => setFailure(null),
    ...actions,
  };
}

interface ActionContext {
  meetingId: string;
  lang: MinutesLang;
  content: MinutesContent;
  hasSaved: boolean;
  onStartedIn: (lang: MinutesLang) => void;
}

interface ActionSinks {
  apply: (dto: MinutesDto) => void;
  setPhase: (phase: MinutesPhase) => void;
  setFailure: (failure: Failure | null) => void;
  setRun: (run: MinutesRunDto | null) => void;
}

function useMinutesActions(ctx: ActionContext, sinks: ActionSinks) {
  const { meetingId, lang, content, hasSaved, onStartedIn } = ctx;
  const { apply, setPhase, setFailure, setRun } = sinks;
  const [saving, setSaving] = useState(false);

  // Starts a background run; the watcher polls it and applies the minutes when it is done.
  // `sourceLang` is the language the minutes are generated in; the other one is translated.
  const generate = useCallback(
    async (sourceLang: MinutesLang = lang) => {
      const here = sourceLang === lang;
      if (here) setPhase("generating");
      setFailure(null);
      try {
        const started = await startMinutesRun(meetingId, sourceLang);
        if (here) setRun(started);
        else onStartedIn(sourceLang);
      } catch (error) {
        setFailure({ action: "generate", message: describeMinutesError("generate", error) });
        if (here) setPhase(hasSaved ? "ready" : "empty");
      }
    },
    [meetingId, lang, hasSaved, onStartedIn, setPhase, setFailure, setRun],
  );

  // (Re-)translates this language from the other one. `confirmOverwrite` replaces hand edits.
  const translate = useCallback(
    async (confirmOverwrite = false) => {
      setPhase("generating");
      setFailure(null);
      try {
        setRun(await startMinutesTranslation(meetingId, lang, confirmOverwrite));
      } catch (error) {
        setFailure({ action: "translate", message: describeMinutesError("translate", error) });
        setPhase(hasSaved ? "ready" : "empty");
      }
    },
    [meetingId, lang, hasSaved, setPhase, setFailure, setRun],
  );

  const save = useCallback(async () => {
    const prepared = prepareForSave(content);
    if (!prepared.ok) return setFailure({ action: "save", message: prepared.message });
    setSaving(true);
    setFailure(null);
    try {
      apply(await saveMinutes(meetingId, lang, prepared.content));
    } catch (error) {
      setFailure({ action: "save", message: describeMinutesError("save", error) });
    } finally {
      setSaving(false);
    }
  }, [content, meetingId, lang, apply, setFailure]);

  return { generate, translate, save, saving };
}

function useDirty(phase: MinutesPhase, saved: MinutesContent | null, content: MinutesContent) {
  return useMemo(
    () => phase === "ready" && saved !== null && JSON.stringify(saved) !== JSON.stringify(content),
    [phase, saved, content],
  );
}

/** Asks the browser to confirm before closing the tab or reloading with unsaved edits. */
function useUnsavedGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}

interface LoadKey {
  meetingId: string;
  lang: MinutesLang;
  /** Bumped by "Tải lại" to refetch. */
  attempt: number;
}

const RUN_FAILED_FALLBACK = "Không tạo được biên bản. Hãy thử lại.";

const runFailure = (run: MinutesRunDto): Failure => ({
  action: run.kind === "translate" ? "translate" : "generate",
  message: run.error ?? RUN_FAILED_FALLBACK,
});

function useLoadMinutes({ meetingId, lang, attempt }: LoadKey, sinks: ActionSinks) {
  const { apply, setPhase, setFailure, setRun } = sinks;
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const dto = await fetchMinutes(meetingId, lang);
      // A failing run lookup must not hide minutes that exist.
      const latest = await fetchMinutesRun(meetingId, lang).catch(() => null);
      if (cancelled) return;
      if (dto) apply(dto);
      setRun(latest);
      if (isActiveRun(latest)) return setPhase("generating");
      if (!dto) setPhase("empty");
      if (latest && hasUnresolvedFailure(latest, dto?.generatedAt ?? null)) {
        setFailure(runFailure(latest));
      }
    };
    load().catch((error: unknown) => {
      if (cancelled) return;
      setFailure({ action: "load", message: describeMinutesError("load", error) });
      setPhase("load-error");
    });
    return () => {
      cancelled = true;
    };
  }, [meetingId, lang, attempt, apply, setPhase, setFailure, setRun]);
}

interface WatchKey {
  meetingId: string;
  lang: MinutesLang;
  run: MinutesRunDto | null;
  hasSaved: boolean;
}

/**
 * While a run is active, polls its state from the server (the DB is the truth, so this also
 * resumes after a page reload). On done it takes the stored minutes; on failure it reports the
 * safe error and falls back to what was there before.
 */
function useRunWatcher({ meetingId, lang, run, hasSaved }: WatchKey, sinks: ActionSinks) {
  const { apply, setPhase, setFailure, setRun } = sinks;
  useRunPolling(isActiveRun(run), async () => {
    let latest: MinutesRunDto | null;
    try {
      latest = await fetchMinutesRun(meetingId, lang);
    } catch {
      return; // transient: keep polling
    }
    setRun(latest);
    if (isActiveRun(latest)) return;
    if (latest && latest.status !== "done") {
      setFailure(runFailure(latest));
      return setPhase(hasSaved ? "ready" : "empty");
    }
    try {
      const dto = await fetchMinutes(meetingId, lang);
      if (dto) apply(dto);
      else setPhase("empty");
    } catch (error) {
      setFailure({ action: "load", message: describeMinutesError("load", error) });
      setPhase("load-error");
    }
  });
}
