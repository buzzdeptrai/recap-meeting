import { BYTES_PER_SAMPLE } from "@recap/core";

/**
 * Expands one mono Int16 PCM frame to interleaved stereo (right channel = silence), so a mic-only
 * session is stored in the same stereo WAV layout as every other recording.
 */
export function monoToStereo(frame: Uint8Array): Uint8Array {
  const samples = Math.floor(frame.length / BYTES_PER_SAMPLE);
  const out = new Uint8Array(samples * BYTES_PER_SAMPLE * 2);
  for (let i = 0; i < samples; i += 1) {
    const from = i * BYTES_PER_SAMPLE;
    const to = i * BYTES_PER_SAMPLE * 2;
    out[to] = frame[from] as number;
    out[to + 1] = frame[from + 1] as number;
  }
  return out;
}
