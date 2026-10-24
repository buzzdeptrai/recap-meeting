import type { SourceStatus } from "@/audio/capture-types";

export interface SilenceDismissed {
  mic: boolean;
  tab: boolean;
}

export const NOT_DISMISSED: SilenceDismissed = { mic: false, tab: false };

/**
 * Keeps a "silent" banner dismissal only while that source is still silent in the same recording.
 * Once the state cleared (or the recording stopped) the next silence shows the banner again.
 */
export function rearmSilenceDismissals(
  dismissed: SilenceDismissed,
  sources: SourceStatus,
  recording: boolean,
): SilenceDismissed {
  const next = {
    mic: recording && dismissed.mic && sources.mic === "silent",
    tab: recording && dismissed.tab && sources.tab === "silent",
  };
  return next.mic === dismissed.mic && next.tab === dismissed.tab ? dismissed : next;
}
