import { describe, expect, it } from "vitest";
import {
  MIC_SILENCE_WINDOW_MS,
  SILENCE_RMS_THRESHOLD,
  TAB_SILENCE_WINDOW_MS,
  createSilenceDetector,
} from "./silence";

const LOUD = SILENCE_RMS_THRESHOLD * 10;
const STEP_MS = 100;

/** Feeds constant levels for `ms` and returns the last flags. */
function run(
  d: ReturnType<typeof createSilenceDetector>,
  mic: number,
  tab: number,
  from: number,
  ms: number,
) {
  let flags = { mic: false, tab: false };
  for (let t = from; t <= from + ms; t += STEP_MS) flags = d.feed(mic, tab, t);
  return flags;
}

const W = MIC_SILENCE_WINDOW_MS;

describe("createSilenceDetector", () => {
  it("uses a much longer window for the mic than for the tab", () => {
    expect(MIC_SILENCE_WINDOW_MS).toBeGreaterThan(TAB_SILENCE_WINDOW_MS);
    expect(MIC_SILENCE_WINDOW_MS).toBeGreaterThanOrEqual(60_000);
  });

  it("does not flag the mic for a listener who stays quiet for the old 12 s or 30 s", () => {
    const d = createSilenceDetector();
    expect(run(d, 0, LOUD, 0, TAB_SILENCE_WINDOW_MS + STEP_MS)).toEqual({ mic: false, tab: false });
  });

  it("flags the quiet mic only after the mic window while the tab has signal", () => {
    const d = createSilenceDetector();
    expect(run(d, 0, LOUD, 0, W - STEP_MS * 2).mic).toBe(false);
    expect(run(d, 0, LOUD, W - STEP_MS, STEP_MS * 3)).toEqual({ mic: true, tab: false });
  });

  it("flags the quiet tab after the tab window while the mic has signal", () => {
    const d = createSilenceDetector();
    expect(run(d, LOUD, 0, 0, TAB_SILENCE_WINDOW_MS - STEP_MS * 2).tab).toBe(false);
    expect(run(d, LOUD, 0, TAB_SILENCE_WINDOW_MS - STEP_MS, STEP_MS * 3)).toEqual({
      mic: false,
      tab: true,
    });
  });

  it("does not flag when both channels are quiet", () => {
    const d = createSilenceDetector();
    expect(run(d, 0, 0, 0, W * 3)).toEqual({ mic: false, tab: false });
  });

  it("stops flagging once the other channel has also been quiet for the window", () => {
    const d = createSilenceDetector();
    run(d, 0, LOUD, 0, W + STEP_MS);
    const start = W + STEP_MS * 2;
    expect(run(d, 0, 0, start, W + STEP_MS)).toEqual({ mic: false, tab: false });
  });

  it("clears as soon as signal returns", () => {
    const d = createSilenceDetector();
    run(d, 0, LOUD, 0, W + STEP_MS);
    expect(d.feed(LOUD, LOUD, W + STEP_MS * 2)).toEqual({ mic: false, tab: false });
  });

  it("reset gives a channel a fresh window", () => {
    const d = createSilenceDetector();
    run(d, 0, LOUD, 0, W + STEP_MS);
    const at = W + STEP_MS * 2;
    d.reset("mic", at);
    expect(d.feed(0, LOUD, at + STEP_MS).mic).toBe(false);
  });
});
