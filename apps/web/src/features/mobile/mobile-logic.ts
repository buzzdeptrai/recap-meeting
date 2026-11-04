import type { SttState } from "@recap/core";
import type { WakeLockState } from "@/audio/wake-lock";
import type { SegmentsPageDto } from "@/lib/api-types";
import type { RecordingState } from "@/lib/status";
import type { ConnectionState } from "@/lib/ws-client";
import { selectSttBanner } from "../meeting-room/stt-banner";
import type { InitialRoomData } from "../meeting-room/use-meeting-socket";

const pad = (n: number) => String(n).padStart(2, "0");

/** "Cuộc họp 14:30 04/11" so a meeting started with one tap is still easy to find in the list. */
export function defaultMeetingTitle(now: Date): string {
  return `Cuộc họp ${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}`;
}

/** Room data of a meeting that has nothing recorded yet. */
export function emptyRoomData(): InitialRoomData {
  const page: SegmentsPageDto = {
    segments: [],
    translations: [],
    nextCursor: null,
    prevCursor: null,
    total: 0,
  };
  return {
    page,
    marks: [],
    markAnchors: {},
    stats: { segments: 0, words: 0, translated: 0 },
    startedAt: null,
  };
}

/** Header status (colour and label come from lib/status.ts). */
export function recordingStateOf(capturing: boolean, connection: ConnectionState): RecordingState {
  if (!capturing) return "idle";
  return connection === "ready" ? "recording" : "reconnecting";
}

export type MobileBannerKind =
  "lock-warning" | "interrupted" | "connection-lost" | "stt-reconnecting" | "stt-failed";

export interface BannerInput {
  recording: boolean;
  interrupted: boolean;
  connection: ConnectionState;
  stt: SttState | null;
}

/** Banners to show, most urgent first. Nothing shows while not recording. */
export function selectMobileBanners(input: BannerInput): MobileBannerKind[] {
  if (!input.recording) return [];
  const banners: MobileBannerKind[] = [];
  if (input.interrupted) banners.push("interrupted");
  if (input.connection === "reconnecting" || input.connection === "closed") {
    banners.push("connection-lost");
  }
  const stt = selectSttBanner({
    stt: input.stt,
    recording: input.recording,
    connection: input.connection,
  });
  if (stt === "failed") banners.push("stt-failed");
  if (stt === "reconnecting") banners.push("stt-reconnecting");
  banners.push("lock-warning");
  return banners;
}

/** Whether the wake lock note should tell the user to keep the screen on themselves. */
export const wakeLockNeedsManualCare = (state: WakeLockState): boolean =>
  state === "unsupported" || state === "denied";
