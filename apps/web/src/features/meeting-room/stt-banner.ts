import type { ErrorCode, SttState } from "@recap/core";
import type { ConnectionState } from "@/lib/ws-client";

export type SttBannerKind = "reconnecting" | "failed";

interface SttBannerInput {
  stt: SttState | null;
  recording: boolean;
  connection: ConnectionState;
}

/** Which speech-to-text banner to show, if any. A dropped browser link wins: its own banner already explains the gap. */
export function selectSttBanner({
  stt,
  recording,
  connection,
}: SttBannerInput): SttBannerKind | null {
  if (!recording) return null;
  if (connection === "reconnecting") return null;
  if (stt === "reconnecting") return "reconnecting";
  if (stt === "closed") return "failed";
  return null;
}

/** Where a manual "Thử lại" of the speech-to-text provider stands (client side only). */
export type SttRetryPhase = "idle" | "waiting" | "connecting" | "failed";

export type SttRetryEvent =
  | { type: "click" }
  | { type: "status"; stt: SttState }
  | { type: "error"; code: ErrorCode }
  | { type: "timeout" }
  | { type: "reset" };

const RETRY_ERROR_CODES: readonly ErrorCode[] = [
  "NOT_RECORDING",
  "STT_ALREADY_OPEN",
  "RATE_LIMITED",
];

/** Errors that answer `stt_retry`; they drive the banner, not the generic error banner. */
export const isSttRetryErrorCode = (code: ErrorCode): boolean => RETRY_ERROR_CODES.includes(code);

const isRunning = (phase: SttRetryPhase) => phase === "waiting" || phase === "connecting";

function onStatus(phase: SttRetryPhase, stt: SttState): SttRetryPhase {
  if (!isRunning(phase)) return phase;
  if (stt === "open" || stt === "reconnecting") return "idle";
  if (stt === "connecting") return "connecting";
  // `closed` before `connecting` is a stale status (e.g. a translate update), not the outcome.
  return phase === "connecting" ? "failed" : phase;
}

export function nextSttRetryPhase(phase: SttRetryPhase, event: SttRetryEvent): SttRetryPhase {
  switch (event.type) {
    case "click":
      return isRunning(phase) ? phase : "waiting";
    case "status":
      return onStatus(phase, event.stt);
    case "error":
      if (!isRunning(phase)) return phase;
      if (event.code === "STT_ALREADY_OPEN") return "idle";
      return isSttRetryErrorCode(event.code) ? "failed" : phase;
    case "timeout":
      return isRunning(phase) ? "failed" : phase;
    case "reset":
      return "idle";
  }
}

export interface SttRetryView {
  loading: boolean;
  disabled: boolean;
  /** Short line under the message, or null. */
  note: string | null;
}

const RETRY_FAILED_NOTE = "Chưa kết nối lại được, thử lại sau ít giây.";
const RETRY_OFFLINE_NOTE = "Chưa kết nối máy chủ ghi âm.";

export function describeSttRetry(phase: SttRetryPhase, connection: ConnectionState): SttRetryView {
  const loading = isRunning(phase);
  if (connection !== "ready") return { loading, disabled: true, note: RETRY_OFFLINE_NOTE };
  return {
    loading,
    disabled: loading,
    note: phase === "failed" ? RETRY_FAILED_NOTE : null,
  };
}
