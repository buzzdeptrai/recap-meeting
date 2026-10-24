import { describe, expect, it } from "vitest";
import { floatToInt16, interleaveStereo, LinearResampler, rms } from "./pcm";

describe("floatToInt16", () => {
  it("maps the range and clamps", () => {
    expect(floatToInt16(0)).toBe(0);
    expect(floatToInt16(1)).toBe(32767);
    expect(floatToInt16(-1)).toBe(-32768);
    expect(floatToInt16(5)).toBe(32767);
    expect(floatToInt16(-5)).toBe(-32768);
  });
});

describe("interleaveStereo", () => {
  it("puts ch0 (mic) first and ch1 (tab) second", () => {
    const out = interleaveStereo(Float32Array.of(1, 0), Float32Array.of(-1, 0.5));
    expect(Array.from(out)).toEqual([32767, -32768, 0, 16384]);
  });

  it("truncates to the shorter channel", () => {
    expect(interleaveStereo(new Float32Array(3), new Float32Array(2)).length).toBe(4);
  });
});

describe("rms", () => {
  it("is 0 for silence and empty input", () => {
    expect(rms(new Float32Array(10))).toBe(0);
    expect(rms([])).toBe(0);
  });

  it("is amplitude/√2 for a sine and exact for a constant", () => {
    expect(rms(Float32Array.of(0.5, 0.5, 0.5))).toBeCloseTo(0.5);
    const sine = Float32Array.from({ length: 1000 }, (_, i) => Math.sin((2 * Math.PI * i) / 100));
    expect(rms(sine)).toBeCloseTo(Math.SQRT1_2, 2);
  });
});

describe("LinearResampler", () => {
  it("is a one-sample-delay identity at equal rates", () => {
    const resampler = new LinearResampler(16000, 16000);
    const a = resampler.process(Float32Array.of(1, 2, 3));
    const b = resampler.process(Float32Array.of(4, 5));
    expect(Array.from(a)).toEqual([1, 2, 3]);
    expect(Array.from(b)).toEqual([4, 5]);
  });

  it("decimates 48 kHz to 16 kHz by 3", () => {
    const resampler = new LinearResampler(48000, 16000);
    const out = resampler.process(Float32Array.from({ length: 480 }, (_, i) => i));
    expect(out.length).toBe(160);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(3);
  });

  it("yields the same samples regardless of block boundaries", () => {
    const input = Float32Array.from({ length: 441 }, (_, i) => Math.sin(i / 7));
    const whole = new LinearResampler(44100, 16000).process(input);
    const split = new LinearResampler(44100, 16000);
    const parts = [input.slice(0, 100), input.slice(100, 250), input.slice(250)].map((p) =>
      Array.from(split.process(p)),
    );
    const joined = parts.flat();
    expect(joined.length).toBe(whole.length);
    joined.forEach((value, i) => expect(value).toBeCloseTo(whole[i] ?? NaN, 5));
  });
});
