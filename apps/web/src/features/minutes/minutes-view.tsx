"use client";

import { useCallback, useEffect, useState } from "react";
import type { MinutesLang, MinutesTopic } from "@recap/core";
import { Info, WarningCircle } from "@phosphor-icons/react";
import type { StaleReason } from "@recap/db";
import { ActionGroup, Banner, Button, Card, ConfirmDialog, EmptyState } from "@recap/admin-ui";
import { fetchMinutes } from "@/lib/api-minutes";
import { NO_AVAILABILITY, withMinutes, type MinutesAvailability } from "./export-options";
import { MinutesEditor } from "./minutes-editor";
import { EmptyMinutes, GeneratingMinutes, LoadingMinutes } from "./minutes-states";
import { MinutesTopBar, type MinutesMeetingInfo } from "./minutes-top-bar";
import { staleBannerText } from "./stale-copy";
import { useMinutes } from "./use-minutes";

type Confirm =
  | { kind: "regenerate" }
  | { kind: "lang"; lang: MinutesLang }
  | { kind: "topic"; topic: MinutesTopic };

const hasBody = (topic: MinutesTopic) => topic.keyPoints.length > 0 || topic.conclusion !== null;

/** Holds the chosen language; the panel under it remounts per language. */
export function MinutesView({ meeting }: { meeting: MinutesMeetingInfo }) {
  const [lang, setLang] = useState<MinutesLang>("vi");
  const { available, markAvailable } = useAvailability(meeting.id);
  return (
    <MinutesPanel
      key={lang}
      meeting={meeting}
      lang={lang}
      onLangChange={setLang}
      available={available}
      onHasMinutes={markAvailable}
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
}

function MinutesPanel({ meeting, lang, onLangChange, available, onHasMinutes }: MinutesPanelProps) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const minutes = useMinutes(meeting.id, lang);
  const { phase, edit, dirty } = minutes;
  const hasSaved = minutes.saved !== null;
  useEffect(() => {
    if (hasSaved) onHasMinutes(lang);
  }, [hasSaved, lang, onHasMinutes]);

  const requestLang = (next: MinutesLang) => {
    if (next === lang) return;
    if (dirty) setConfirm({ kind: "lang", lang: next });
    else onLangChange(next);
  };
  const requestRemoveTopic = (topic: MinutesTopic) => {
    if (hasBody(topic)) setConfirm({ kind: "topic", topic });
    else edit({ type: "topic/remove", id: topic.id });
  };

  return (
    <div className="min-h-dvh">
      <MinutesTopBar
        meeting={meeting}
        lang={lang}
        onLangChange={requestLang}
        saved={phase === "ready" || phase === "generating" ? minutes.saved : null}
        dirty={dirty}
        saving={minutes.saving}
        busy={phase === "generating"}
        available={available}
        onSave={minutes.save}
        onRegenerate={() => setConfirm({ kind: "regenerate" })}
      />
      <PanelBanners minutes={minutes} onRegenerate={() => setConfirm({ kind: "regenerate" })} />
      <main className="py-6">
        <PanelBody meeting={meeting} minutes={minutes} onRemoveTopic={requestRemoveTopic} />
      </main>
      <MinutesConfirm
        confirm={confirm}
        onClose={() => setConfirm(null)}
        onRegenerate={minutes.generate}
        onSwitchLang={onLangChange}
        onRemoveTopic={(id) => edit({ type: "topic/remove", id })}
      />
    </div>
  );
}

function PanelBanners({
  minutes,
  onRegenerate,
}: {
  minutes: ReturnType<typeof useMinutes>;
  onRegenerate: () => void;
}) {
  const { failure, phase, saved } = minutes;
  return (
    <>
      {failure && (
        <FailureBanner
          message={failure.message}
          onRetry={failure.action === "generate" ? minutes.generate : undefined}
          onDismiss={minutes.dismissFailure}
        />
      )}
      {phase === "ready" && saved?.stale && (
        <StaleBanner reasons={saved.staleReasons} onRegenerate={onRegenerate} />
      )}
    </>
  );
}

interface PanelBodyProps {
  meeting: MinutesMeetingInfo;
  minutes: ReturnType<typeof useMinutes>;
  onRemoveTopic: (topic: MinutesTopic) => void;
}

function PanelBody({ meeting, minutes, onRemoveTopic }: PanelBodyProps) {
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
        <EmptyMinutes meetingId={meeting.id} ended={meeting.ended} onGenerate={minutes.generate} />
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

interface MinutesConfirmProps {
  confirm: Confirm | null;
  onClose: () => void;
  onRegenerate: () => void;
  onSwitchLang: (lang: MinutesLang) => void;
  onRemoveTopic: (id: string) => void;
}

/** Keeps the last copy while the dialog fades out, so the title never flashes empty. */
function MinutesConfirm({
  confirm,
  onClose,
  onRegenerate,
  onSwitchLang,
  onRemoveTopic,
}: MinutesConfirmProps) {
  const [shown, setShown] = useState<Confirm | null>(confirm);
  if (confirm && confirm !== shown) setShown(confirm);
  const copy = shown && describe(shown);
  const run = () => {
    if (!shown) return;
    if (shown.kind === "regenerate") onRegenerate();
    if (shown.kind === "lang") onSwitchLang(shown.lang);
    if (shown.kind === "topic") onRemoveTopic(shown.topic.id);
  };
  return (
    <ConfirmDialog
      open={confirm !== null}
      onOpenChange={(open) => !open && onClose()}
      title={copy?.title ?? ""}
      description={copy?.description}
      confirmLabel={copy?.action ?? ""}
      destructive={copy?.destructive ?? false}
      onConfirm={run}
    />
  );
}

function describe(confirm: Confirm) {
  switch (confirm.kind) {
    case "regenerate":
      return {
        title: "Tạo lại biên bản?",
        description:
          "Biên bản mới sẽ thay thế bản hiện tại. Mọi chỉnh sửa của bạn trong ngôn ngữ này sẽ mất.",
        action: "Tạo lại",
        destructive: true,
      };
    case "lang":
      return {
        title: "Bỏ thay đổi chưa lưu?",
        description: "Bạn có chỉnh sửa chưa lưu. Chuyển ngôn ngữ sẽ bỏ các chỉnh sửa này.",
        action: "Bỏ và chuyển",
        destructive: true,
      };
    case "topic":
      return {
        title: "Xóa chủ đề này?",
        description: "Các ý chính và kết luận của chủ đề sẽ bị xóa khỏi biên bản.",
        action: "Xóa chủ đề",
        destructive: true,
      };
  }
}

interface FailureBannerProps {
  message: string;
  /** Present for a failed generation: runs it again. */
  onRetry?: () => void;
  onDismiss: () => void;
}

function FailureBanner({ message, onRetry, onDismiss }: FailureBannerProps) {
  return (
    <Banner
      tone="error"
      icon={<WarningCircle />}
      className="mt-3"
      action={
        <ActionGroup>
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              Thử lại
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Đóng
          </Button>
        </ActionGroup>
      }
    >
      {message}
    </Banner>
  );
}

function StaleBanner({
  reasons,
  onRegenerate,
}: {
  reasons: StaleReason[];
  onRegenerate: () => void;
}) {
  return (
    <Banner
      tone="warn"
      icon={<Info />}
      className="mt-3"
      action={
        <Button size="sm" variant="outline" onClick={onRegenerate}>
          Tạo lại
        </Button>
      }
    >
      {staleBannerText(reasons)}
    </Banner>
  );
}
