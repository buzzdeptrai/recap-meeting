const BYTES_PER_SAMPLE = 2;
const INT16_FULL_SCALE = 32_768;

/**
 * RMS level (0..1 of full scale) of one little-endian Int16 mono buffer. Empty input is silence.
 * Odd trailing bytes are ignored.
 */
export function rmsLevel(mono: Uint8Array): number {
  const samples = Math.floor(mono.byteLength / BYTES_PER_SAMPLE);
  if (samples === 0) return 0;
  const view = new DataView(mono.buffer, mono.byteOffset, samples * BYTES_PER_SAMPLE);
  let sumSquares = 0;
  for (let i = 0; i < samples; i += 1) {
    const sample = view.getInt16(i * BYTES_PER_SAMPLE, true) / INT16_FULL_SCALE;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples);
}
