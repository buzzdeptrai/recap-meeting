/**
 * Detects a dead channel while the browser still reports its track as "live".
 * A channel is silent when its RMS stayed under the threshold for the whole window AND the other
 * channel had signal inside that same window. If both are quiet nobody may be talking: no flag.
 */

/** RMS below this is "no signal" (about -54 dBFS, below room noise of a live mic). */
export const SILENCE_RMS_THRESHOLD = 0.002;
/**
 * How long the MIC must stay quiet (while the tab is active) before it is flagged. Long on purpose:
 * someone who only listens (or noise suppression gating a quiet room) is not a dead mic. Real
 * device loss / ended / mute are separate states and stay immediate.
 */
export const MIC_SILENCE_WINDOW_MS = 60_000;
/** Same for the TAB: the other side pausing for a few seconds is normal, so not 12 s any more. */
export const TAB_SILENCE_WINDOW_MS = 30_000;

export interface SilenceFlags {
  mic: boolean;
  tab: boolean;
}

export interface SilenceDetector {
  /** Feed one frame's RMS values with a monotonic timestamp (ms). Returns the current flags. */
  feed: (mic: number, tab: number, nowMs: number) => SilenceFlags;
  /** Forget one channel's history (e.g. the tab was re-shared); it gets a fresh window. */
  reset: (channel: keyof SilenceFlags, nowMs: number) => void;
}

interface Options {
  threshold?: number;
  micWindowMs?: number;
  tabWindowMs?: number;
}

export function createSilenceDetector({
  threshold = SILENCE_RMS_THRESHOLD,
  micWindowMs = MIC_SILENCE_WINDOW_MS,
  tabWindowMs = TAB_SILENCE_WINDOW_MS,
}: Options = {}): SilenceDetector {
  const windows: Record<keyof SilenceFlags, number> = { mic: micWindowMs, tab: tabWindowMs };
  const lastSignal: Record<keyof SilenceFlags, number | null> = { mic: null, tab: null };

  const quietFor = (channel: keyof SilenceFlags, nowMs: number) =>
    nowMs - (lastSignal[channel] ?? nowMs);
  const isSilent = (own: keyof SilenceFlags, other: keyof SilenceFlags, nowMs: number) =>
    quietFor(own, nowMs) >= windows[own] && quietFor(other, nowMs) < windows[own];

  return {
    feed(mic, tab, nowMs) {
      if (lastSignal.mic === null || mic >= threshold) lastSignal.mic = nowMs;
      if (lastSignal.tab === null || tab >= threshold) lastSignal.tab = nowMs;
      return { mic: isSilent("mic", "tab", nowMs), tab: isSilent("tab", "mic", nowMs) };
    },
    reset(channel, nowMs) {
      lastSignal[channel] = nowMs;
    },
  };
}
