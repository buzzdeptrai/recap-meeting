"use client";

import type { ErrorMessage } from "@recap/core";
import type { CapturePhase } from "./use-audio-capture";
import type { SourceStatus } from "@/audio/capture";
import { WarningCircle, WarningOctagon } from "@phosphor-icons/react";
import { Banner, Button } from "@recap/admin-ui";
import type { ConnectionState } from "@/lib/ws-client";
import type { SttState } from "@recap/core";
import { describeServerError } from "./error-copy";
import { selectSttBanner } from "./stt-banner";

const TAB_AUDIO_MISSING =
  "Chưa nhận được âm thanh cuộc họp. Hãy chia sẻ lại và tích “Chia sẻ âm thanh tab”.";
const MIC_BLOCKED =
  "Không dùng được micro. Cho phép micro trong thanh địa chỉ của trình duyệt để ghi phần của bạn.";
const SERVER_DOWN =
  "Không kết nối được máy chủ ghi âm. Âm thanh trong lúc mất kết nối sẽ không được ghi. Đang tự thử lại.";
const STT_RECONNECTING =
  "Dịch vụ nhận dạng giọng nói đang kết nối lại. Âm thanh vẫn được ghi và sẽ được bổ sung vào bản ghi khi nối lại xong.";
const STT_FAILED =
  "Dịch vụ nhận dạng giọng nói đã ngắt và không tự nối lại được. Phần âm thanh từ lúc này sẽ không có chữ. Hãy dừng ghi rồi tiếp tục cuộc họp để kết nối lại.";

interface RoomBannersProps {
  phase: CapturePhase;
  sources: SourceStatus;
  captureError: string | null;
  connection: ConnectionState;
  stt: SttState | null;
  serverError: ErrorMessage | null;
  onReshare: () => void;
  onRetry: () => void;
  onDismissError: () => void;
}

function ActionBanner({
  tone,
  actionLabel,
  onAction,
  children,
}: {
  tone: "warn" | "error";
  actionLabel: string;
  onAction: () => void;
  children: string;
}) {
  return (
    <Banner
      tone={tone}
      radius="lg"
      icon={tone === "error" ? <WarningOctagon /> : <WarningCircle />}
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

function SttBanners({ kind }: { kind: ReturnType<typeof selectSttBanner> }) {
  if (kind === "reconnecting") {
    return (
      <Banner tone="warn" radius="lg" icon={<WarningCircle />}>
        {STT_RECONNECTING}
      </Banner>
    );
  }
  if (kind === "failed") {
    return (
      <Banner tone="error" radius="lg" icon={<WarningOctagon />}>
        {STT_FAILED}
      </Banner>
    );
  }
  return null;
}

/**
 * Rounded cards under the header; each says what went wrong and offers the fix. Only the one-off
 * server error can be dismissed: every other banner mirrors a live condition (it disappears when
 * the condition clears and would be wrong to hide while it still holds).
 */
export function RoomBanners(props: RoomBannersProps) {
  const recording = props.phase === "running";
  const sttBanner = selectSttBanner({
    stt: props.stt,
    recording,
    connection: props.connection,
  });
  return (
    <>
      {props.captureError && (
        <Banner tone="warn" radius="lg" icon={<WarningCircle />}>
          {props.captureError}
        </Banner>
      )}
      {recording && props.sources.tab !== "ok" && (
        <ActionBanner tone="warn" actionLabel="Chia sẻ lại" onAction={props.onReshare}>
          {TAB_AUDIO_MISSING}
        </ActionBanner>
      )}
      {recording && props.sources.mic !== "ok" && (
        <Banner tone="warn" radius="lg" icon={<WarningCircle />}>
          {MIC_BLOCKED}
        </Banner>
      )}
      {recording && props.connection === "reconnecting" && (
        <ActionBanner tone="error" actionLabel="Thử lại" onAction={props.onRetry}>
          {SERVER_DOWN}
        </ActionBanner>
      )}
      <SttBanners kind={sttBanner} />
      {props.serverError && (
        <Banner
          tone="warn"
          radius="lg"
          icon={<WarningCircle />}
          onDismiss={props.onDismissError}
          dismissLabel="Đóng"
        >
          {describeServerError(props.serverError)}
        </Banner>
      )}
    </>
  );
}
