import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCaptureRecorder } from "../src/capture-recorder";
import { parseCapture } from "../../../tools/replay-segmenter/src/capture";

const RAW = JSON.stringify({ type: "Turn", transcript: "xin chào", end_of_turn: false });

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "recap-capture-"));
}

describe("capture recorder", () => {
  it("is off when no path is given", () => {
    expect(createCaptureRecorder(undefined)).toBeUndefined();
    expect(createCaptureRecorder("  ")).toBeUndefined();
  });

  it("writes lines the replay tool parses back unchanged (file path)", () => {
    const file = join(tmp(), "cap.jsonl");
    let now = 1_000;
    const recorder = createCaptureRecorder(file, () => now)!;
    now = 1_250;
    recorder.record(0, RAW, 0);
    now = 2_000;
    recorder.record(1, RAW, 4_800);
    const lines = parseCapture(readFileSync(file, "utf8"));
    expect(lines).toEqual([
      { tMs: 250, ch: 0, base: 0, raw: RAW },
      { tMs: 1_000, ch: 1, base: 4_800, raw: RAW },
    ]);
  });

  it("creates a timestamped file inside a directory (one per recorder)", () => {
    const dir = tmp();
    const a = createCaptureRecorder(`${dir}/sub/`)!;
    a.record(0, RAW, 0);
    expect(a.filePath.startsWith(join(dir, "sub", "stt-capture-"))).toBe(true);
    expect(a.filePath.endsWith(".jsonl")).toBe(true);
    expect(parseCapture(readFileSync(a.filePath, "utf8"))).toHaveLength(1);
  });

  it("never throws when the file cannot be written", () => {
    const blocker = join(tmp(), "a-file");
    writeFileSync(blocker, "x");
    const recorder = createCaptureRecorder(join(blocker, "cap.jsonl"))!; // parent is a file
    expect(() => recorder.record(0, RAW, 0)).not.toThrow();
    expect(() => recorder.record(0, RAW, 0)).not.toThrow();
  });
});
