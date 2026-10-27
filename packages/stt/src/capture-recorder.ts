import { appendFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Channel } from "@recap/core";

/**
 * Sink for raw provider text frames (debug capture for `tools/replay-segmenter`). Frames hold only
 * transcript JSON: never the API key or the connection URL.
 */
export interface SttCaptureRecorder {
  record(channel: Channel, raw: string, baseMs: number): void;
}

/** A recorder that appends JSONL `{tMs,ch,base,raw}` to `filePath`. */
export interface FileCaptureRecorder extends SttCaptureRecorder {
  readonly filePath: string;
}

function isDirectoryTarget(target: string): boolean {
  if (/[\\/]$/.test(target)) return true;
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function resolveFile(target: string, now: number): string {
  if (!isDirectoryTarget(target)) return target;
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
  return join(target, `stt-capture-${stamp}.jsonl`);
}

/**
 * `target` = a file path, or a directory (existing, or ending in a slash) that gets one
 * `stt-capture-<time>.jsonl` per recorder. Empty/undefined = capture off. A write failure disables
 * the recorder after one warning; capture must never disturb a live session.
 */
export function createCaptureRecorder(
  target: string | undefined,
  now: () => number = Date.now,
): FileCaptureRecorder | undefined {
  const path = target?.trim();
  if (!path) return undefined;
  const startedAt = now();
  const filePath = resolveFile(path, startedAt);
  let broken = false;
  return {
    filePath,
    record(channel, raw, baseMs) {
      if (broken) return;
      try {
        mkdirSync(dirname(filePath), { recursive: true });
        const line = { tMs: now() - startedAt, ch: channel, base: baseMs, raw };
        appendFileSync(filePath, `${JSON.stringify(line)}\n`);
      } catch (error) {
        broken = true;
        console.error("[stt] capture disabled:", error instanceof Error ? error.message : error);
      }
    },
  };
}
