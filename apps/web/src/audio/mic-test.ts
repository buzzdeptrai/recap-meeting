import { SILENCE_RMS_THRESHOLD } from "./silence";

/** In the pre-record test the mic is "quiet" after this long without signal. */
export const MIC_TEST_QUIET_MS = 4_000;

export interface SilenceTimer {
  /** Feed one RMS sample with a monotonic timestamp; returns true while quiet for the whole window. */
  feed: (rms: number, nowMs: number) => boolean;
}

export function createSilenceTimer(
  windowMs: number,
  threshold: number = SILENCE_RMS_THRESHOLD,
): SilenceTimer {
  let lastSignal: number | null = null;
  return {
    feed(rms, nowMs) {
      if (lastSignal === null || rms >= threshold) lastSignal = nowMs;
      return nowMs - lastSignal >= windowMs;
    },
  };
}
