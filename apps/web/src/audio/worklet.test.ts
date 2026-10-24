import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { FRAME_BYTES, FRAME_SAMPLES } from "@recap/core";
import { describe, expect, it } from "vitest";

interface FrameMessage {
  type: string;
  pcm: ArrayBuffer;
  levels: [number, number];
}
interface Processor {
  port: { postMessage: (message: FrameMessage) => void };
  process: (inputs: Float32Array[][]) => boolean;
}

const source = readFileSync(
  resolve(import.meta.dirname, "../../public/worklets/pcm-encoder.js"),
  "utf8",
);

/** Evaluates the real worklet file with a stubbed AudioWorklet global scope. */
function createProcessor(rate: number): { processor: Processor; frames: FrameMessage[] } {
  const frames: FrameMessage[] = [];
  let ctor: new (options: unknown) => Processor = undefined as never;
  class Base {
    port = { postMessage: (message: FrameMessage) => frames.push(message) };
  }
  vm.runInNewContext(source, {
    AudioWorkletProcessor: Base,
    sampleRate: rate,
    registerProcessor: (_name: string, c: typeof ctor) => (ctor = c),
    Math,
    Int16Array,
  });
  return { processor: new ctor({}), frames };
}

const block = (length: number, value: number) => new Float32Array(length).fill(value);

describe("pcm-encoder worklet", () => {
  it("emits exact 6400-byte stereo frames with ch0 = mic and ch1 = tab", () => {
    const { processor, frames } = createProcessor(16000);
    for (let i = 0; i < FRAME_SAMPLES / 128 + 2; i++) {
      processor.process([[block(128, 0.5), block(128, -0.25)]]);
    }
    expect(frames.length).toBe(1);
    const frame = frames[0]!;
    expect(frame.pcm.byteLength).toBe(FRAME_BYTES);
    const samples = new Int16Array(frame.pcm);
    expect(samples[10]).toBe(16384);
    expect(samples[11]).toBe(-8192);
    expect(frame.levels[0]).toBeCloseTo(0.5, 2);
    expect(frame.levels[1]).toBeCloseTo(0.25, 2);
  });

  it("downsamples 48 kHz input to 16 kHz frames", () => {
    const { processor, frames } = createProcessor(48000);
    const blocks = Math.ceil((FRAME_SAMPLES * 3) / 128) + 1;
    for (let i = 0; i < blocks; i++) processor.process([[block(128, 0.1), block(128, 0.1)]]);
    expect(frames.length).toBe(1);
    expect(frames[0]!.pcm.byteLength).toBe(FRAME_BYTES);
  });

  it("treats a missing channel as silence", () => {
    const { processor, frames } = createProcessor(16000);
    for (let i = 0; i < 14; i++) processor.process([[block(128, 0.5)]]);
    const samples = new Int16Array(frames[0]!.pcm);
    expect(samples[1]).toBe(0);
    expect(frames[0]!.levels[1]).toBe(0);
  });
});
