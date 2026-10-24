/**
 * Detects the mic re-capturing the speakers (acoustic echo): the tab channel (ch1) is a clean
 * reference, and an echoing mic (ch0) carries a weaker, slightly delayed copy of its envelope.
 *
 * Detection only: nothing here changes the audio or what is sent to STT.
 * ALL THRESHOLDS BELOW ARE UNCALIBRATED GUESSES, to be tuned on a real speaker + mic recording.
 */

/** One frame = 100 ms (FRAME_SAMPLES at SAMPLE_RATE). */
export const FRAME_MS = 100;
/** Sliding window the statistics are computed over (8 s). */
export const ECHO_WINDOW_FRAMES = 80;
/** Largest speaker-to-mic delay searched, in frames (300 ms). Lag 0 is included. */
export const ECHO_MAX_LAG_FRAMES = 3;
/** Floor of the dB envelope so silence does not dominate the correlation. */
export const ENVELOPE_FLOOR_DB = -60;
/** Tab RMS at or above this counts as "the others are talking" (about -40 dBFS). */
export const TAB_ACTIVE_RMS = 0.01;
/** Share of the window in which the tab must be active before anything can be flagged. */
export const MIN_TAB_ACTIVE_SHARE = 0.3;
/** Mean mic RMS (over tab-active frames) below this means the mic hears nothing: not an echo. */
export const MIC_ACTIVE_RMS = 0.002;
/** Mean mic/tab level ratio (tab-active frames) must be below this to enter echo. */
export const ENTER_MAX_LEVEL_RATIO = 0.6;
/** Envelope correlation must reach this to enter echo. */
export const ENTER_MIN_CORRELATION = 0.7;
/** Looser limits used while already flagged (hysteresis): the pattern must clearly stop. */
export const EXIT_MAX_LEVEL_RATIO = 0.8;
export const EXIT_MIN_CORRELATION = 0.5;
/** The enter condition must hold this many consecutive frames (5 s) before flagging. */
export const ENTER_SUSTAIN_FRAMES = 50;
/** The exit condition (pattern gone) must hold this many consecutive frames (5 s) to clear. */
export const EXIT_SUSTAIN_FRAMES = 50;

export interface EchoDetector {
  /** Feed one frame's RMS values (0..1). Returns whether echo is currently flagged. */
  feed: (mic: number, tab: number) => boolean;
  /** Forget all history and clear the flag (e.g. the tab was re-shared). */
  reset: () => void;
}

export function toDb(rms: number): number {
  if (rms <= 0) return ENVELOPE_FLOOR_DB;
  return Math.max(ENVELOPE_FLOOR_DB, 20 * Math.log10(rms));
}

/** Pearson correlation of two equal-length series; 0 when either has no variance. */
export function pearson(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i]!;
    meanB += b[i]!;
  }
  meanA /= n;
  meanB /= n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

/** Best correlation of mic[i] with tab[i - lag] for lag in 0..maxLag (the mic hears the tab late). */
export function maxLaggedCorrelation(
  mic: readonly number[],
  tab: readonly number[],
  maxLag: number,
): number {
  let best = -1;
  for (let lag = 0; lag <= maxLag; lag++) {
    if (mic.length - lag < 2) break;
    best = Math.max(best, pearson(mic.slice(lag), tab.slice(0, tab.length - lag)));
  }
  return best;
}

export interface EchoStats {
  tabActiveShare: number;
  micMean: number;
  /** Mean mic RMS / mean tab RMS over tab-active frames. */
  levelRatio: number;
  correlation: number;
}

/** Window statistics, or null when the tab was too quiet to say anything. */
export function computeEchoStats(mic: readonly number[], tab: readonly number[]): EchoStats | null {
  let active = 0;
  let micSum = 0;
  let tabSum = 0;
  for (let i = 0; i < tab.length; i++) {
    if (tab[i]! < TAB_ACTIVE_RMS) continue;
    active += 1;
    micSum += mic[i]!;
    tabSum += tab[i]!;
  }
  const tabActiveShare = tab.length === 0 ? 0 : active / tab.length;
  if (active === 0 || tabActiveShare < MIN_TAB_ACTIVE_SHARE) return null;
  const correlation = maxLaggedCorrelation(mic.map(toDb), tab.map(toDb), ECHO_MAX_LAG_FRAMES);
  return { tabActiveShare, micMean: micSum / active, levelRatio: micSum / tabSum, correlation };
}

/** True when the window looks like the mic re-hearing the tab (limits differ for enter/exit). */
export function looksLikeEcho(
  stats: EchoStats | null,
  limits: { maxRatio: number; minCorrelation: number },
): boolean {
  if (!stats) return false;
  return (
    stats.micMean >= MIC_ACTIVE_RMS &&
    stats.levelRatio < limits.maxRatio &&
    stats.correlation >= limits.minCorrelation
  );
}

const ENTER_LIMITS = { maxRatio: ENTER_MAX_LEVEL_RATIO, minCorrelation: ENTER_MIN_CORRELATION };
const EXIT_LIMITS = { maxRatio: EXIT_MAX_LEVEL_RATIO, minCorrelation: EXIT_MIN_CORRELATION };

export function createEchoDetector(): EchoDetector {
  let mic: number[] = [];
  let tab: number[] = [];
  let flagged = false;
  let streak = 0;

  const advance = (hit: boolean, needed: number) => {
    streak = hit ? streak + 1 : 0;
    if (streak < needed) return;
    flagged = !flagged;
    streak = 0;
  };

  return {
    feed(micRms, tabRms) {
      mic.push(micRms);
      tab.push(tabRms);
      if (mic.length > ECHO_WINDOW_FRAMES) {
        mic.shift();
        tab.shift();
      }
      if (mic.length < ECHO_WINDOW_FRAMES) return flagged;
      const stats = computeEchoStats(mic, tab);
      // Too little tab speech to judge: neither build up nor lose the current evidence.
      if (!stats) return flagged;
      if (flagged) advance(!looksLikeEcho(stats, EXIT_LIMITS), EXIT_SUSTAIN_FRAMES);
      else advance(looksLikeEcho(stats, ENTER_LIMITS), ENTER_SUSTAIN_FRAMES);
      return flagged;
    },
    reset() {
      mic = [];
      tab = [];
      flagged = false;
      streak = 0;
    },
  };
}
