"use client";

import { useCallback, useEffect, useState } from "react";
import type { MinutesLang, MinutesTopic } from "@recap/core";
import { WarningCircle } from "@phosphor-icons/react";
import { Button, Card, EmptyState } from "@recap/admin-ui";
import { fetchMinutes } from "@/lib/api-minutes";
import { NO_AVAILABILITY, withMinutes, type MinutesAvailability } from "./export-options";
import { MinutesEditor } from "./minutes-editor";
import { FailureBanner, StaleBanner, TranslatingBanner } from "./minutes-banners";
import { MinutesConfirm } from "./minutes-dialogs";
import { DEFAULT_SOURCE_LANG, otherMinutesLang } from "./minutes-langs";
import { EmptyMinutes, GeneratingMinutes, LoadingMinutes } from "./minutes-states";
import { MinutesTopBar, type MinutesMeetingInfo } from "./minutes-top-bar";
import { useMinutes } from "./use-minutes";
import { usePanelRequests } from "./use-panel-requests";
import { useRunsOverview } from "./use-runs-overview";

/** Holds the chosen language; the panel under it remounts per language. */
export function MinutesView({ meeting }: { meeting: MinutesMeetingInfo }) {
  const [lang, setLang] = useState<MinutesLang>(DEFAULT_SOURCE_LANG);
  const { available, markAvailable } = useAvailability(meeting.id);
  const overview = useRunsOverview(meeting.id, markAvailable);
  return (
    <MinutesPanel
      key={lang}
      meeting={meeting}
      lang={lang}
      onLangChange={setLang}
      available={available}
      onHasMinutes={markAvailable}
      translatingInto={overview.translatingInto}
      onRunEnded={overview.refresh}
    />
  );
}

/** Which languages have minutes, for the Word export menu (the panel only knows its own language). */
function useAvailability(meetingId: string) {
  const [available, setAvailable] = useState<MinutesAvailability>(NO_AVAILABILITY);
  const markAvailable = useCallback(
    (lang: MinutesLang) => setAvailable((current) => withMinutes(current, lang)),
    [],
  );
  useEffect(() => {
    let cancelled = false;
    for (const lang of ["vi", "en"] as const) {
      fetchMinutes(meetingId, lang)
        .then((dto) => !cancelled && dto && markAvailable(lang))
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [meetingId, markAvailable]);
  return { available, markAvailable };
}

interface MinutesPanelProps {
  meeting: MinutesMeetingInfo;
  lang: MinutesLang;
  onLangChange: (lang: MinutesLang) => void;
  available: MinutesAvailability;
  onHasMinutes: (lang: MinutesLang) => void;
  /** Language a translation is running into right now (any tab), or null. */
  translatingInto: MinutesLang | null;
  /** Called when a run of this panel ended, so the page re-reads the runs (a translation follows). */
  onRunEnded: () => void;
}

function MinutesPanel(props: MinutesPanelProps) {
  const { meeting, lang, onLangChange, available, translatingInto } = props;
  const minutes = useMinutes(meeting.id, lang, onLangChange);
  const { phase, edit, dirty, saved } = minutes;
  const req = usePanelRequests({ ...props, minutes });
  const other = otherMinutesLang(lang);

  return (
    <div className="min-h-dvh">
      <MinutesTopBar
        meeting={meeting}
        lang={lang}
        onLangChange={req.requestLang}
        saved={phase === "ready" || phase === "generating" ? saved : null}
        dirty={dirty}
        saving={minutes.saving}
        busy={phase === "generating"}
        available={available}
        onSave={minutes.save}
        onRegenerate={req.requestAct}
      />
      <PanelBanners
        minutes={minutes}
        onAct={req.requestAct}
        onRetryGenerate={() => void minutes.generate(lang)}
        onRetryTranslate={req.requestTranslate}
        notice={translatingInto !== lang ? translatingInto : null}
      />
      <main className="py-6">
        <PanelBody
          meeting={meeting}
          minutes={minutes}
          translateFrom={available[other] ? other : null}
          onTranslate={req.requestTranslate}
          onRemoveTopic={req.requestRemoveTopic}
        />
      </main>
      <MinutesConfirm
        confirm={req.confirm}
        lang={lang}
        otherExists={available[other]}
        onClose={req.closeConfirm}
        onRegenerate={(sourceLang) => void minutes.generate(sourceLang)}
        onRetranslate={() => void minutes.translate(true)}
        onSwitchLang={onLangChange}
        onRemoveTopic={(id) => edit({ type: "topic/remove", id })}
      />
    </div>
  );
}

interface PanelBannersProps {
  minutes: ReturnType<typeof useMinutes>;
  onAct: () => void;
  onRetryGenerate: () => void;
  onRetryTranslate: () => void;
  /** Language being translated into elsewhere (shown on the other tab); null = nothing running. */
  notice: MinutesLang | null;
}

function PanelBanners({
  minutes,
  onAct,
  onRetryGenerate,
  onRetryTranslate,
  notice,
}: PanelBannersProps) {
  const { failure, phase, saved } = minutes;
  const retry = failure?.action === "translate" ? onRetryTranslate : onRetryGenerate;
  const canRetry = failure?.action === "generate" || failure?.action === "translate";
  return (
    <>
      {failure && (
        <FailureBanner
          message={failure.message}
          onRetry={canRetry ? retry : undefined}
          onDismiss={minutes.dismissFailure}
        />
      )}
      {notice && phase === "ready" && <TranslatingBanner into={notice} />}
      {phase === "ready" && saved?.stale && (
        <StaleBanner
          reasons={saved.staleReasons}
          derived={saved.derivedFromLang !== null}
          onAct={onAct}
        />
      )}
    </>
  );
}

interface PanelBodyProps {
  meeting: MinutesMeetingInfo;
  minutes: ReturnType<typeof useMinutes>;
  translateFrom: MinutesLang | null;
  onTranslate: () => void;
  onRemoveTopic: (topic: MinutesTopic) => void;
}

function PanelBody({
  meeting,
  minutes,
  translateFrom,
  onTranslate,
  onRemoveTopic,
}: PanelBodyProps) {
  switch (minutes.phase) {
    case "loading":
      return <LoadingMinutes />;
    case "load-error":
      return (
        <Card>
          <EmptyState
            icon={<WarningCircle />}
            tone="red"
            title="Không tải được biên bản"
            description="Có lỗi khi đọc biên bản của cuộc họp này. Thử tải lại."
            action={<Button onClick={minutes.reload}>Tải lại</Button>}
          />
        </Card>
      );
    case "empty":
      return (
        <EmptyMinutes
          meetingId={meeting.id}
          ended={meeting.ended}
          onGenerate={(sourceLang) => void minutes.generate(sourceLang)}
          translateFrom={translateFrom}
          onTranslate={onTranslate}
        />
      );
    case "generating":
      return <GeneratingMinutes run={minutes.run} />;
    case "ready":
      return (
        <MinutesEditor
          meetingId={meeting.id}
          content={minutes.content}
          edit={minutes.edit}
          onRemoveTopic={onRemoveTopic}
        />
      );
  }
}
