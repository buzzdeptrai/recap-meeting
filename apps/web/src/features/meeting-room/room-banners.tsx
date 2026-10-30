"use client";

import type { CapturePhase } from "./use-audio-capture";
import type { SourceStatus } from "@/audio/capture";
import { Info, WarningCircle, WarningOctagon } from "@phosphor-icons/react";
import { useState } from "react";
import { Banner, Button } from "@recap/admin-ui";
import type { ConnectionState } from "@/lib/ws-client";
import type { RoomState } from "./state";
import { MicBanner } from "./mic-banner";
import { NOT_DISMISSED, rearmSilenceDismissals, type SilenceDismissed } from "./silence-dismissal";
import { describeServerError } from "./error-copy";
import { describeSttRetry, selectSttBanner, type SttRetryPhase } from "./stt-banner";

const TAB_AUDIO_MISSING =
  "Chưa nhận được âm thanh cuộc họp. Hãy chia sẻ lại và tích “Chia sẻ âm thanh tab”.";
const TAB_AUDIO_SILENT =
  "Không nhận được tiếng từ tab cuộc họp. Kiểm tra tab Zoom có đang bị tắt tiếng không.";
const MIC_ECHO =
  "Micro đang thu lại tiếng loa. Hãy đeo tai nghe để tiếng người khác không bị ghi hai lần.";
const RECORDING_STAY =
  "Đang ghi. Đừng đóng tab hoặc chuyển trang; hãy bấm Kết thúc khi họp xong rồi mới rời đi.";
const SERVER_DOWN =
  "Không kết nối được máy chủ ghi âm. Âm thanh trong lúc mất kết nối sẽ không được ghi. Đang tự thử lại.";
const STT_RECONNECTING =
  "Dịch vụ nhận dạng giọng nói đang kết nối lại. Âm thanh vẫn được ghi và sẽ được bổ sung vào bản ghi khi nối lại xong.";
const STT_FAILED =
  "Dịch vụ nhận dạng giọng nói đã ngắt và không tự nối lại được. Bấm Thử lại để kết nối lại; âm thanh trong lúc ngắt sẽ không có chữ.";

interface RoomBannersProps {
  phase: CapturePhase;
  sources: SourceStatus;
  captureError: string | null;
  connection: ConnectionState;
  room: RoomState;
  onReshare: () => void;
  onSwitchMic: (deviceId: string) => Promise<boolean>;
  onRetry: () => void;
  onRetryStt: () => void;
  onDismissError: () => void;
}

function ActionBanner({
  tone,
  actionLabel,
  onAction,
  onDismiss,
  children,
}: {
  tone: "warn" | "error";
  actionLabel: string;
  onAction: () => void;
  onDismiss?: () => void;
  children: string;
}) {
  return (
    <Banner
      tone={tone}
      radius="lg"
      icon={tone === "error" ? <WarningOctagon /> : <WarningCircle />}
      onDismiss={onDismiss}
      dismissLabel={onDismiss ? "Đóng" : undefined}
      action={
        <Button size="sm" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      }
    >
      {children}
    </Banner>
  );
}

function StayBanner() {
  return (
    <Banner tone="info" radius="lg" icon={<Info />}>
      {RECORDING_STAY}
    </Banner>
  );
}

interface SttBannersProps {
  kind: ReturnType<typeof selectSttBanner>;
  phase: SttRetryPhase;
  connection: ConnectionState;
  onRetry: () => void;
}

function SttBanners({ kind, phase, connection, onRetry }: SttBannersProps) {
  if (kind === "reconnecting") {
    return (
      <Banner tone="warn" radius="lg" icon={<WarningCircle />}>
        {STT_RECONNECTING}
      </Banner>
    );
  }
  if (kind === "failed") {
    const view = describeSttRetry(phase, connection);
    return (
      <Banner
        tone="error"
        radius="lg"
        icon={<WarningOctagon />}
        action={
          <Button
            size="sm"
            variant="tonal"
            loading={view.loading}
            disabled={view.disabled}
            onClick={onRetry}
          >
            Thử lại
          </Button>
        }
      >
        {view.note ? `${STT_FAILED} ${view.note}` : STT_FAILED}
      </Banner>
    );
  }
  return null;
}

interface SourceBannersProps {
  sources: SourceStatus;
  echoDismissed: boolean;
  silenceDismissed: SilenceDismissed;
  onDismissEcho: () => void;
  onDismissSilence: (source: keyof SilenceDismissed) => void;
  onReshare: () => void;
  onSwitchMic: (deviceId: string) => Promise<boolean>;
}

/** Tab / mic problems and the advisory echo warning (shown only while recording). */
function SourceBanners({
  sources,
  echoDismissed,
  silenceDismissed,
  ...actions
}: SourceBannersProps) {
  const tabSilent = sources.tab === "silent";
  const showTab = sources.tab !== "ok" && !(tabSilent && silenceDismissed.tab);
  const showMic = sources.mic !== "ok" && !(sources.mic === "silent" && silenceDismissed.mic);
  return (
    <>
      {showTab && (
        <ActionBanner
          tone="warn"
          actionLabel="Chia sẻ lại"
          onAction={actions.onReshare}
          onDismiss={tabSilent ? () => actions.onDismissSilence("tab") : undefined}
        >
          {tabSilent ? TAB_AUDIO_SILENT : TAB_AUDIO_MISSING}
        </ActionBanner>
      )}
      {showMic && (
        <MicBanner
          mic={sources.mic as Exclude<SourceStatus["mic"], "ok">}
          onSwitchMic={actions.onSwitchMic}
          onDismiss={sources.mic === "silent" ? () => actions.onDismissSilence("mic") : undefined}
        />
      )}
      {sources.echo === true && !echoDismissed && (
        <Banner
          tone="warn"
          radius="lg"
          icon={<WarningCircle />}
          onDismiss={actions.onDismissEcho}
          dismissLabel="Đóng"
        >
          {MIC_ECHO}
        </Banner>
      )}
    </>
  );
}

/** Echo warning dismissal lives for one recording: it is re-armed once recording stops. */
function useEchoDismissal(recording: boolean): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(false);
  const [wasRecording, setWasRecording] = useState(recording);
  if (recording !== wasRecording) {
    setWasRecording(recording);
    if (!recording) setDismissed(false);
  }
  return [dismissed, () => setDismissed(true)];
}

/** Silent-banner dismissals last for one recording and re-arm once the source recovered. */
function useSilenceDismissal(
  recording: boolean,
  sources: SourceStatus,
): [SilenceDismissed, (source: keyof SilenceDismissed) => void] {
  const [dismissed, setDismissed] = useState(NOT_DISMISSED);
  const rearmed = rearmSilenceDismissals(dismissed, sources, recording);
  if (rearmed !== dismissed) setDismissed(rearmed);
  return [rearmed, (source) => setDismissed({ ...rearmed, [source]: true })];
}

function useDismissals(recording: boolean, sources: SourceStatus) {
  const [echoDismissed, onDismissEcho] = useEchoDismissal(recording);
  const [silenceDismissed, onDismissSilence] = useSilenceDismissal(recording, sources);
  return { echoDismissed, onDismissEcho, silenceDismissed, onDismissSilence };
}

/**
 * Rounded cards under the header; each says what went wrong and offers the fix. The one-off
 * server error and the advisory echo warning can be dismissed (echo: for the current recording
 * only); every other banner mirrors a live condition and would be wrong to hide while it holds.
 */
export function RoomBanners(props: RoomBannersProps) {
  const recording = props.phase === "running";
  const dismissals = useDismissals(recording, props.sources);
  const sttBanner = selectSttBanner({
    stt: props.room.stt,
    recording,
    connection: props.connection,
  });
  return (
    <>
      {recording && <StayBanner />}
      {props.captureError && (
        <Banner tone="warn" radius="lg" icon={<WarningCircle />}>
          {props.captureError}
        </Banner>
      )}
      {recording && (
        <SourceBanners
          sources={props.sources}
          {...dismissals}
          onReshare={props.onReshare}
          onSwitchMic={props.onSwitchMic}
        />
      )}
      {recording && props.connection === "reconnecting" && (
        <ActionBanner tone="error" actionLabel="Thử lại" onAction={props.onRetry}>
          {SERVER_DOWN}
        </ActionBanner>
      )}
      <SttBanners
        kind={sttBanner}
        phase={props.room.sttRetry}
        connection={props.connection}
        onRetry={props.onRetryStt}
      />
      {props.room.lastError && (
        <Banner
          tone="warn"
          radius="lg"
          icon={<WarningCircle />}
          onDismiss={props.onDismissError}
          dismissLabel="Đóng"
        >
          {describeServerError(props.room.lastError)}
        </Banner>
      )}
    </>
  );
}
