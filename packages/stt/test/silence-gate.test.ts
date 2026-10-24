import { describe, expect, it } from "vitest";
import { FRAME_MS } from "@recap/core";
import { SilenceGate, rmsLevel, type GateFrame } from "../src";

const IDLE_MS = 500; // 5 frames
const PRE_ROLL_FRAMES = 15;
const LOUD = 0.2;
const QUIET = 0;
/** Between SLEEP_LEVEL (0.005) and WAKE_LEVEL (0.012). */
const MURMUR = 0.008;

let counter = 0;
const frame = (): GateFrame => ({ index: counter++, data: new Uint8Array(2) });

/** Feeds `levels` and returns every output. */
function feed(gate: SilenceGate, levels: number[]) {
  return levels.map((level) => {
    const f = frame();
    return { f, out: gate.process(f, level) };
  });
}

describe("rmsLevel", () => {
  it("is 0 for silence and empty input, and normalised to full scale", () => {
    expect(rmsLevel(new Uint8Array(0))).toBe(0);
    expect(rmsLevel(new Uint8Array(8))).toBe(0);
    const full = new Uint8Array(new Int16Array([16384, -16384]).buffer);
    expect(rmsLevel(full)).toBeCloseTo(0.5, 5);
  });
});

describe("SilenceGate", () => {
  it("passes everything when disabled", () => {
    const gate = new SilenceGate({ idleAfterMs: 0 });
    const outputs = feed(gate, Array(100).fill(QUIET));
    expect(outputs.every(({ out }) => out.send.length === 1 && out.transition === null)).toBe(true);
    expect(gate.state).toBe("active");
  });

  it("goes idle after the silence window and sends nothing from then on", () => {
    const gate = new SilenceGate({ idleAfterMs: IDLE_MS });
    const idleFrames = IDLE_MS / FRAME_MS;
    const outputs = feed(gate, Array(idleFrames + 3).fill(QUIET));
    expect(outputs.slice(0, idleFrames - 1).every(({ out }) => out.send.length === 1)).toBe(true);
    expect(outputs[idleFrames - 1]?.out).toEqual({ send: [], transition: "idle" });
    expect(outputs.slice(idleFrames).every(({ out }) => out.send.length === 0)).toBe(true);
    expect(gate.state).toBe("idle");
  });

  it("a loud frame resets the silence count", () => {
    const gate = new SilenceGate({ idleAfterMs: IDLE_MS });
    feed(gate, [QUIET, QUIET, QUIET, QUIET, LOUD, QUIET, QUIET, QUIET, QUIET]);
    expect(gate.state).toBe("active");
  });

  it("wakes on the first loud frame and flushes the pre-roll in order, capped at 1.5 s", () => {
    const gate = new SilenceGate({ idleAfterMs: IDLE_MS });
    const quiet = feed(gate, Array(5 + 30).fill(QUIET));
    const [wake] = feed(gate, [LOUD]);
    expect(wake?.out.transition).toBe("wake");
    const sent = wake?.out.send ?? [];
    expect(sent).toHaveLength(PRE_ROLL_FRAMES + 1);
    expect(sent.at(-1)).toBe(wake?.f);
    const expected = quiet.slice(-PRE_ROLL_FRAMES).map(({ f }) => f);
    expect(sent.slice(0, -1)).toEqual(expected);
    const indexes = sent.map((f) => f.index);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    expect(gate.state).toBe("active");
  });

  it("does not leak the ring into the next idle period", () => {
    const gate = new SilenceGate({ idleAfterMs: IDLE_MS });
    feed(gate, [...Array(10).fill(QUIET), LOUD]);
    const second = feed(gate, [...Array(5).fill(QUIET), ...Array(2).fill(QUIET), LOUD]);
    expect(second.at(-1)?.out.send).toHaveLength(2 + 1 + 1); // idle frame + 2 quiet + wake
  });

  it("uses hysteresis: a murmur neither wakes an idle channel nor counts as sound", () => {
    const gate = new SilenceGate({ idleAfterMs: IDLE_MS });
    feed(gate, Array(5).fill(QUIET));
    expect(feed(gate, [MURMUR])[0]?.out.transition).toBeNull();
    expect(gate.state).toBe("idle");
    // while active, a murmur is above the sleep level, so it keeps the channel awake
    const awake = new SilenceGate({ idleAfterMs: IDLE_MS });
    feed(awake, [QUIET, QUIET, QUIET, QUIET, MURMUR, QUIET, QUIET, QUIET, QUIET]);
    expect(awake.state).toBe("active");
  });

  it("cannot flap faster than the idle window after waking", () => {
    const gate = new SilenceGate({ idleAfterMs: IDLE_MS });
    feed(gate, [...Array(5).fill(QUIET), LOUD]);
    const next = feed(gate, Array(4).fill(QUIET));
    expect(next.every(({ out }) => out.transition === null)).toBe(true);
  });

  it("reset() returns to active with an empty ring", () => {
    const gate = new SilenceGate({ idleAfterMs: IDLE_MS });
    feed(gate, Array(8).fill(QUIET));
    gate.reset();
    expect(gate.state).toBe("active");
    expect(feed(gate, [QUIET])[0]?.out.send).toHaveLength(1);
  });
});
