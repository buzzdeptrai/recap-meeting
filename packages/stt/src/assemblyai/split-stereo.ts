const BYTES_PER_SAMPLE = 2;
const BYTES_PER_STEREO_FRAME = BYTES_PER_SAMPLE * 2;

/**
 * Splits one interleaved Int16 stereo PCM buffer into two mono Int16 buffers (left = ch0 mic,
 * right = ch1 meeting tab). A trailing partial sample frame is dropped.
 */
export function splitStereo(frame: Uint8Array): [Uint8Array, Uint8Array] {
  const samples = Math.floor(frame.byteLength / BYTES_PER_STEREO_FRAME);
  const left = new Uint8Array(samples * BYTES_PER_SAMPLE);
  const right = new Uint8Array(samples * BYTES_PER_SAMPLE);
  for (let i = 0; i < samples; i += 1) {
    const from = i * BYTES_PER_STEREO_FRAME;
    const to = i * BYTES_PER_SAMPLE;
    left[to] = frame[from] as number;
    left[to + 1] = frame[from + 1] as number;
    right[to] = frame[from + 2] as number;
    right[to + 1] = frame[from + 3] as number;
  }
  return [left, right];
}
