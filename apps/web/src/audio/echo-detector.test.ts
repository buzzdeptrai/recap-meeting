import { describe, expect, it } from "vitest";
import {
  ECHO_WINDOW_FRAMES,
  ENTER_SUSTAIN_FRAMES,
  EXIT_SUSTAIN_FRAMES,
  computeEchoStats,
  createEchoDetector,
  looksLikeEcho,
  maxLaggedCorrelation,
  pearson,
  toDb,
} from "./echo-detector";

/** Deterministic PRNG (mulberry32) so the synthetic envelopes are reproducible. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Speech-like envelope: bursts of 3..15 frames at 0.03..0.15 RMS separated by quiet gaps. */
function speech(frames: number, seed: number): number[] {
  const next = rng(seed);
  const out: number[] = [];
  let on = next() > 0.5;
  while (out.length < frames) {
    const length = 3 + Math.floor(next() * 13);
    for (let i = 0; i < length; i++) out.push(on ? 0.03 + next() * 0.12 : 0.0005 + next() * 0.001);
    on = !on;
  }
  return out.slice(0, frames);
}

const quiet = (frames: number, seed: number) => {
  const next = rng(seed);
  return Array.from({ length: frames }, () => 0.0003 + next() * 0.0007);
};

/** The mic hears the tab `gain` times weaker and `lag` frames late, plus a little noise. */
function echoOf(tab: number[], gain: number, lag: number, seed: number): number[] {
  const noise = quiet(tab.length, seed);
  return tab.map((_, i) => gain * (tab[i - lag] ?? 0) + noise[i]!);
}

function run(mic: number[], tab: number[]): boolean[] {
  const detector = createEchoDetector();
  return mic.map((value, i) => detector.feed(value, tab[i]!));
}

const FRAMES = 300;
const flagAfterWarmup = ECHO_WINDOW_FRAMES + ENTER_SUSTAIN_FRAMES;

describe("helpers", () => {
  it("toDb floors silence and maps full scale to 0", () => {
    expect(toDb(0)).toBe(-60);
    expect(toDb(1)).toBeCloseTo(0);
    expect(toDb(0.1)).toBeCloseTo(-20);
  });

  it("pearson handles identical, inverse and flat series", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
    expect(pearson([1], [1])).toBe(0);
  });

  it("maxLaggedCorrelation finds the delayed copy", () => {
    const tab = toDbSeries(speech(100, 1));
    const mic = [0, 0, ...tab.slice(0, 98)];
    expect(maxLaggedCorrelation(mic, tab, 0)).toBeLessThan(0.9);
    expect(maxLaggedCorrelation(mic, tab, 3)).toBeGreaterThan(0.99);
  });

  it("computeEchoStats is null when the tab is mostly quiet", () => {
    expect(computeEchoStats(quiet(80, 2), quiet(80, 3))).toBeNull();
  });

  it("looksLikeEcho needs an audible, weaker, correlated mic", () => {
    const limits = { maxRatio: 0.6, minCorrelation: 0.7 };
    const base = { tabActiveShare: 0.8, micMean: 0.01, levelRatio: 0.3, correlation: 0.9 };
    expect(looksLikeEcho(base, limits)).toBe(true);
    expect(looksLikeEcho(null, limits)).toBe(false);
    expect(looksLikeEcho({ ...base, micMean: 0.0005 }, limits)).toBe(false);
    expect(looksLikeEcho({ ...base, levelRatio: 1.2 }, limits)).toBe(false);
    expect(looksLikeEcho({ ...base, correlation: 0.2 }, limits)).toBe(false);
  });
});

function toDbSeries(values: number[]) {
  return values.map(toDb);
}

describe("createEchoDetector", () => {
  it("flags a pure echo only after the window and the sustain time", () => {
    const tab = speech(FRAMES, 10);
    const flags = run(echoOf(tab, 0.3, 2, 11), tab);
    expect(flags.slice(0, ECHO_WINDOW_FRAMES).some(Boolean)).toBe(false);
    expect(flags[flagAfterWarmup + 5]).toBe(true);
    expect(flags[FRAMES - 1]).toBe(true);
  });

  it.each([0, 1, 3])("handles a speaker-to-mic delay of %i frames", (lag) => {
    const tab = speech(FRAMES, 12);
    expect(run(echoOf(tab, 0.25, lag, 13), tab)[FRAMES - 1]).toBe(true);
  });

  it("does not flag the user speaking alone", () => {
    const flags = run(speech(FRAMES, 20), quiet(FRAMES, 21));
    expect(flags.some(Boolean)).toBe(false);
  });

  it("does not flag the tab alone with a silent mic", () => {
    const flags = run(quiet(FRAMES, 30), speech(FRAMES, 31));
    expect(flags.some(Boolean)).toBe(false);
  });

  it("does not flag both sides speaking independently", () => {
    const flags = run(speech(FRAMES, 40), speech(FRAMES, 41));
    expect(flags.some(Boolean)).toBe(false);
  });

  it("does not flag a user who only occasionally talks over the others", () => {
    const tab = speech(FRAMES, 50);
    const own = speech(FRAMES, 51);
    const mic = quiet(FRAMES, 52).map((noise, i) => (i % 100 < 15 ? own[i]! : noise));
    expect(run(mic, tab).some(Boolean)).toBe(false);
  });

  it("clears with hysteresis once the echo stops", () => {
    const tab = speech(FRAMES * 2, 60);
    const mic = [
      ...echoOf(tab.slice(0, FRAMES), 0.3, 2, 61),
      ...quiet(FRAMES, 62), // headphones on: mic hears nothing of the tab
    ];
    const flags = run(mic, tab);
    expect(flags[FRAMES - 1]).toBe(true);
    expect(flags[FRAMES + 5]).toBe(true); // still flagged shortly after: no flicker
    expect(flags[FRAMES * 2 - 1]).toBe(false);
    expect(FRAMES).toBeGreaterThan(ECHO_WINDOW_FRAMES + EXIT_SUSTAIN_FRAMES);
  });

  it("reset clears the flag and the history", () => {
    const tab = speech(FRAMES, 70);
    const mic = echoOf(tab, 0.3, 2, 71);
    const detector = createEchoDetector();
    mic.forEach((value, i) => detector.feed(value, tab[i]!));
    detector.reset();
    expect(detector.feed(mic[0]!, tab[0]!)).toBe(false);
  });
});
