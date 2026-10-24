import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { BYTES_PER_SAMPLE, CHANNELS, FRAME_SAMPLES, SAMPLE_RATE } from "@recap/core";

const FFMPEG_BIN = process.env.FFMPEG_PATH ?? "ffmpeg";
const MAX_STDERR_CHARS = 400;

/** `npm run -w` starts in the workspace dir; user-supplied paths are relative to where npm was run. */
export const userPath = (path: string): string =>
  resolve(process.env.INIT_CWD ?? process.cwd(), path);

/** Decodes any audio file ffmpeg understands to mono 16 kHz Int16 samples. */
export function decodeToMono16k(file: string): Promise<Int16Array> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-i",
      userPath(file),
      "-f",
      "s16le",
      "-ac",
      "1",
      "-ar",
      String(SAMPLE_RATE),
    ];
    const child = spawn(FFMPEG_BIN, [...args, "-"], { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.once("error", (error) => reject(new Error(`Cannot run ffmpeg: ${error.message}`)));
    child.once("close", (code) => {
      if (code !== 0)
        return reject(new Error(`ffmpeg failed: ${stderr.slice(0, MAX_STDERR_CHARS)}`));
      const bytes = Buffer.concat(chunks);
      const samples = Math.floor(bytes.length / BYTES_PER_SAMPLE);
      resolve(new Int16Array(bytes.buffer, bytes.byteOffset, samples).slice());
    });
  });
}

/**
 * Interleaves into exact FRAME_BYTES stereo frames: ch0 = `mic` (silence when null),
 * ch1 = `others`. The shorter side is zero-padded; the last frame is zero-padded to full size.
 */
export function toStereoFrames(mic: Int16Array | null, others: Int16Array): Uint8Array[] {
  const total = Math.max(mic?.length ?? 0, others.length);
  const frameCount = Math.ceil(total / FRAME_SAMPLES);
  const frames: Uint8Array[] = [];
  for (let f = 0; f < frameCount; f++) {
    const samples = new Int16Array(FRAME_SAMPLES * CHANNELS);
    for (let i = 0; i < FRAME_SAMPLES; i++) {
      const at = f * FRAME_SAMPLES + i;
      samples[i * CHANNELS] = mic?.[at] ?? 0;
      samples[i * CHANNELS + 1] = others[at] ?? 0;
    }
    frames.push(new Uint8Array(samples.buffer));
  }
  return frames;
}

export const audioDurationMs = (samples: number) => Math.round((samples / SAMPLE_RATE) * 1000);
