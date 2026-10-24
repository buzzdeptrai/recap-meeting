"use client";

import type { MinutesContent, MinutesLang } from "@recap/core";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { fetchMinutes, generateMinutes, saveMinutes } from "@/lib/api-minutes";
import type { MinutesDto } from "@/lib/api-types";
import { EMPTY_CONTENT, editReducer, type EditAction } from "./edit-reducer";
import { describeMinutesError, type MinutesAction } from "./error-copy";
import { prepareForSave } from "./prepare-save";

export type MinutesPhase = "loading" | "empty" | "generating" | "ready" | "load-error";

interface Failure {
  action: MinutesAction;
  message: string;
}

/**
 * Loads, generates, edits and saves the minutes of one meeting in one language.
 * The caller remounts it (via `key`) when the language changes, so state never mixes languages.
 */
export function useMinutes(meetingId: string, lang: MinutesLang) {
  const [phase, setPhase] = useState<MinutesPhase>("loading");
  const [saved, setSaved] = useState<MinutesDto | null>(null);
  const [content, dispatch] = useReducer(editReducer, EMPTY_CONTENT);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);

  const apply = useCallback((dto: MinutesDto) => {
    setSaved(dto);
    dispatch({ type: "reset", content: dto.content });
    setPhase("ready");
  }, []);

  useLoadMinutes({ meetingId, lang, attempt }, { apply, setPhase, setFailure });

  const reload = () => {
    setFailure(null);
    setPhase("loading");
    setAttempt((n) => n + 1);
  };
  const actions = useMinutesActions(
    { meetingId, lang, content, hasSaved: saved !== null },
    {
      apply,
      setPhase,
      setFailure,
    },
  );
  const dirty = useDirty(phase, saved?.content ?? null, content);
  useUnsavedGuard(dirty);

  return {
    phase,
    saved,
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
}

interface ActionSinks {
  apply: (dto: MinutesDto) => void;
  setPhase: (phase: MinutesPhase) => void;
  setFailure: (failure: Failure | null) => void;
}

function useMinutesActions(ctx: ActionContext, sinks: ActionSinks) {
  const { meetingId, lang, content, hasSaved } = ctx;
  const { apply, setPhase, setFailure } = sinks;
  const [saving, setSaving] = useState(false);

  const generate = useCallback(async () => {
    setPhase("generating");
    setFailure(null);
    try {
      apply(await generateMinutes(meetingId, lang));
    } catch (error) {
      setFailure({ action: "generate", message: describeMinutesError("generate", error) });
      setPhase(hasSaved ? "ready" : "empty");
    }
  }, [meetingId, lang, hasSaved, apply, setPhase, setFailure]);

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

  return { generate, save, saving };
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

function useLoadMinutes({ meetingId, lang, attempt }: LoadKey, sinks: ActionSinks) {
  const { apply, setPhase, setFailure } = sinks;
  useEffect(() => {
    let cancelled = false;
    fetchMinutes(meetingId, lang)
      .then((dto) => {
        if (cancelled) return;
        if (dto) apply(dto);
        else setPhase("empty");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFailure({ action: "load", message: describeMinutesError("load", error) });
        setPhase("load-error");
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId, lang, attempt, apply, setPhase, setFailure]);
}
