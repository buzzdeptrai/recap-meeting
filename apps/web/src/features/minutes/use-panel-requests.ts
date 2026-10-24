"use client";

import { useEffect, useState } from "react";
import type { MinutesLang, MinutesTopic } from "@recap/core";
import type { Confirm } from "./minutes-confirm";
import type { useMinutes } from "./use-minutes";

const hasBody = (topic: MinutesTopic) => topic.keyPoints.length > 0 || topic.conclusion !== null;

interface PanelRequestsInput {
  lang: MinutesLang;
  minutes: ReturnType<typeof useMinutes>;
  onLangChange: (lang: MinutesLang) => void;
  onHasMinutes: (lang: MinutesLang) => void;
  onRunEnded: () => void;
}

/**
 * What the buttons of one language panel ask for, and which of them need a confirmation first
 * (hand edits are never replaced or dropped silently). Also reports to the page when this panel
 * has minutes and when its run ended.
 */
export function usePanelRequests(input: PanelRequestsInput) {
  const { lang, minutes, onLangChange, onHasMinutes, onRunEnded } = input;
  const { saved, dirty, edit } = minutes;
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const hasSaved = saved !== null;
  useEffect(() => {
    if (hasSaved) onHasMinutes(lang);
  }, [hasSaved, lang, onHasMinutes]);
  const runStatus = minutes.run?.status;
  useEffect(() => {
    if (runStatus === "done") onRunEnded();
  }, [runStatus, onRunEnded]);

  const requestTranslate = () => {
    if (saved?.source === "edited") setConfirm({ kind: "retranslate" });
    else void minutes.translate(false);
  };
  const derived = Boolean(saved?.derivedFromLang);
  return {
    confirm,
    closeConfirm: () => setConfirm(null),
    requestTranslate,
    /** A translation is translated again; source minutes are regenerated. */
    requestAct: () => (derived ? requestTranslate() : setConfirm({ kind: "regenerate" })),
    requestLang: (next: MinutesLang) => {
      if (next === lang) return;
      if (dirty) setConfirm({ kind: "lang", lang: next });
      else onLangChange(next);
    },
    requestRemoveTopic: (topic: MinutesTopic) => {
      if (hasBody(topic)) setConfirm({ kind: "topic", topic });
      else edit({ type: "topic/remove", id: topic.id });
    },
  };
}
