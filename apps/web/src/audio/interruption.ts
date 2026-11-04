/**
 * Detects that capture stopped delivering sound although the user did not stop it. On iOS Safari
 * this happens when the screen locks, a call or Siri takes the mic, or the tab is backgrounded:
 * the mic track ends or mutes, or the AudioContext is suspended / "interrupted".
 */

/** No frame from the worklet for this long while "running" = the audio thread is stalled. */
export const FRAME_STALL_MS = 3_000;

export interface CaptureHealth {
  /** `none` = no mic track attached. */
  trackState: "live" | "ended" | "none";
  trackMuted: boolean;
  /** AudioContext.state; Safari adds "interrupted" to the standard values. */
  contextState: string;
  /** Milliseconds since the last frame, null before the first one. */
  msSinceFrame: number | null;
}

export type InterruptionReason = "mic-ended" | "mic-muted" | "context-stopped" | "no-frames";

/** Why capture is considered interrupted, or null while it is healthy. */
export function interruptionReason(health: CaptureHealth): InterruptionReason | null {
  if (health.trackState !== "live") return "mic-ended";
  if (health.trackMuted) return "mic-muted";
  if (health.contextState !== "running") return "context-stopped";
  if (health.msSinceFrame !== null && health.msSinceFrame > FRAME_STALL_MS) return "no-frames";
  return null;
}

export const isCaptureInterrupted = (health: CaptureHealth): boolean =>
  interruptionReason(health) !== null;

/** Reads the health of a mic track (null = none attached). */
export function trackHealth(
  track: Pick<MediaStreamTrack, "readyState" | "muted"> | null,
): Pick<CaptureHealth, "trackState" | "trackMuted"> {
  if (!track) return { trackState: "none", trackMuted: false };
  return {
    trackState: track.readyState === "live" ? "live" : "ended",
    trackMuted: track.muted,
  };
}
