import { appendFileSync } from "node:fs";
import type { Channel } from "@recap/core";

/** One recorded raw provider text frame. `tMs` = ms since the capture started (wall clock). */
export interface CaptureLine {
  tMs: number;
  ch: Channel;
  /** Socket time base (`connectionBaseMs` of the channel session); 0 when never reconnected. */
  base: number;
  /** The provider message exactly as received (a JSON string). */
  raw: string;
}

const VALID_CHANNELS = new Set([0, 1]);

/** Parses a capture JSONL; throws with the 1-based line number on the first bad line. */
export function parseCapture(text: string): CaptureLine[] {
  const lines: CaptureLine[] = [];
  const rows = text.split("\n");
  rows.forEach((row, index) => {
    if (!row.trim()) return;
    lines.push(parseCaptureLine(row, index + 1));
  });
  return lines;
}

function parseCaptureLine(row: string, lineNo: number): CaptureLine {
  let value: Partial<CaptureLine>;
  try {
    value = JSON.parse(row) as Partial<CaptureLine>;
  } catch {
    throw new Error(`capture line ${lineNo}: not valid JSON`);
  }
  if (typeof value.tMs !== "number" || !Number.isFinite(value.tMs)) {
    throw new Error(`capture line ${lineNo}: "tMs" must be a number`);
  }
  if (typeof value.ch !== "number" || !VALID_CHANNELS.has(value.ch)) {
    throw new Error(`capture line ${lineNo}: "ch" must be 0 or 1`);
  }
  if (typeof value.raw !== "string") {
    throw new Error(`capture line ${lineNo}: "raw" must be a string`);
  }
  return { tMs: value.tMs, ch: value.ch as Channel, base: value.base ?? 0, raw: value.raw };
}

/**
 * Opt-in recorder. Call `record(channel, raw, baseMs)` for every provider text frame, e.g. from
 * `ChannelSession.handleMessage`, when an env flag is set. Appends one JSONL line per frame.
 */
export class CaptureRecorder {
  private readonly startedAt: number;

  constructor(
    private readonly filePath: string,
    private readonly now: () => number = Date.now,
  ) {
    this.startedAt = now();
  }

  record(channel: Channel, raw: string, baseMs = 0): void {
    const line: CaptureLine = { tMs: this.now() - this.startedAt, ch: channel, base: baseMs, raw };
    appendFileSync(this.filePath, `${JSON.stringify(line)}\n`);
  }
}
