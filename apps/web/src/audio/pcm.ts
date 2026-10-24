/**
 * Pure PCM helpers. `public/worklets/pcm-encoder.js` re-implements the same maths
 * (a worklet cannot import modules) and is tested against these in worklet.test.ts.
 */

const INT16_MAX = 0x7fff;
const INT16_MIN = -0x8000;

/** Float sample in [-1, 1] → clamped Int16. */
export function floatToInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? Math.round(clamped * -INT16_MIN) : Math.round(clamped * INT16_MAX);
}

/** Interleave two equal-length mono Float32 buffers as L,R,L,R… Int16 (ch0 first). */
export function interleaveStereo(ch0: Float32Array, ch1: Float32Array): Int16Array {
  const length = Math.min(ch0.length, ch1.length);
  const out = new Int16Array(length * 2);
  for (let i = 0; i < length; i++) {
    out[i * 2] = floatToInt16(ch0[i] ?? 0);
    out[i * 2 + 1] = floatToInt16(ch1[i] ?? 0);
  }
  return out;
}

/** Root-mean-square of a block, 0..1. Empty block → 0. */
export function rms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i] ?? 0;
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Streaming linear-interpolation resampler for one channel. Feed consecutive blocks;
 * state carries the fractional read position and the previous block's last sample.
 */
export class LinearResampler {
  private readonly step: number;
  private position = 1;
  private previous = 0;

  constructor(inputRate: number, outputRate: number) {
    this.step = inputRate / outputRate;
  }

  process(input: Float32Array): Float32Array {
    const out: number[] = [];
    const n = input.length;
    const at = (index: number) => (index === 0 ? this.previous : (input[index - 1] ?? 0));
    for (;;) {
      const index = Math.floor(this.position);
      const frac = this.position - index;
      if ((frac === 0 ? index : index + 1) > n) break;
      const a = at(index);
      out.push(frac === 0 ? a : a + (at(index + 1) - a) * frac);
      this.position += this.step;
    }
    this.position -= n;
    if (n > 0) this.previous = input[n - 1] ?? 0;
    return Float32Array.from(out);
  }
}
