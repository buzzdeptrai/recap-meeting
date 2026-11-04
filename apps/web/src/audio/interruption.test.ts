import { describe, expect, it } from "vitest";
import {
  FRAME_STALL_MS,
  interruptionReason,
  isCaptureInterrupted,
  trackHealth,
  type CaptureHealth,
} from "./interruption";

const healthy: CaptureHealth = {
  trackState: "live",
  trackMuted: false,
  contextState: "running",
  msSinceFrame: 100,
};

describe("interruptionReason", () => {
  it("is null while everything delivers sound", () => {
    expect(interruptionReason(healthy)).toBeNull();
    expect(isCaptureInterrupted(healthy)).toBe(false);
  });

  it("is null before the first frame arrived", () => {
    expect(interruptionReason({ ...healthy, msSinceFrame: null })).toBeNull();
  });

  it("flags an ended or missing mic track", () => {
    expect(interruptionReason({ ...healthy, trackState: "ended" })).toBe("mic-ended");
    expect(interruptionReason({ ...healthy, trackState: "none" })).toBe("mic-ended");
  });

  it("flags a muted track (call, Siri)", () => {
    expect(interruptionReason({ ...healthy, trackMuted: true })).toBe("mic-muted");
  });

  it("flags a suspended or interrupted AudioContext", () => {
    expect(interruptionReason({ ...healthy, contextState: "suspended" })).toBe("context-stopped");
    expect(interruptionReason({ ...healthy, contextState: "interrupted" })).toBe("context-stopped");
  });

  it("flags a stalled audio thread only after the stall threshold", () => {
    expect(interruptionReason({ ...healthy, msSinceFrame: FRAME_STALL_MS })).toBeNull();
    expect(interruptionReason({ ...healthy, msSinceFrame: FRAME_STALL_MS + 1 })).toBe("no-frames");
  });
});

describe("trackHealth", () => {
  it("maps a live, ended and missing track", () => {
    expect(trackHealth({ readyState: "live", muted: false })).toEqual({
      trackState: "live",
      trackMuted: false,
    });
    expect(trackHealth({ readyState: "ended", muted: false }).trackState).toBe("ended");
    expect(trackHealth({ readyState: "live", muted: true }).trackMuted).toBe(true);
    expect(trackHealth(null).trackState).toBe("none");
  });
});
