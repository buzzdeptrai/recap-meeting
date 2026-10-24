import type { SttState } from "@recap/core";
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
