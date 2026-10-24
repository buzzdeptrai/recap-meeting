import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FRAME_BYTES } from "@recap/core";
import { describe, expect, it } from "vitest";
import { AudioWriter, wavPathFor } from "../src/audio/audio-writer";

const tempDir = () => mkdtempSync(join(tmpdir(), "recap-wav-"));
const frame = (value: number) => Buffer.alloc(FRAME_BYTES, value);

function readHeader(path: string) {
  const buf = readFileSync(path);
  return {
    riff: buf.toString("ascii", 0, 4),
    riffSize: buf.readUInt32LE(4),
    wave: buf.toString("ascii", 8, 12),
    channels: buf.readUInt16LE(22),
    sampleRate: buf.readUInt32LE(24),
    bits: buf.readUInt16LE(34),
    dataSize: buf.readUInt32LE(40),
    size: buf.length,
  };
}

describe("AudioWriter", () => {
  it("writes a valid stereo 16 kHz header up front and patches sizes on close", () => {
    const path = join(tempDir(), "nested", "m1.wav");
    const writer = AudioWriter.open(path);
    expect(readHeader(path).dataSize).toBe(0);
    writer.write(frame(1));
    writer.write(frame(2));
    writer.close();
    writer.close();
    expect(readHeader(path)).toEqual({
      riff: "RIFF",
      riffSize: 36 + 2 * FRAME_BYTES,
      wave: "WAVE",
      channels: 2,
      sampleRate: 16_000,
      bits: 16,
      dataSize: 2 * FRAME_BYTES,
      size: 44 + 2 * FRAME_BYTES,
    });
    expect(writer.durationMs).toBe(200);
  });

  it("keeps a recoverable file when the writer is never closed", () => {
    const path = join(tempDir(), "crash.wav");
    const writer = AudioWriter.open(path);
    writer.write(frame(1));
    writer.write(frame(1));
    writer.write(Buffer.alloc(3)); // torn trailing write
    // Simulate the crash: header still says 0 bytes, but reopening repairs it from the length.
    const reopened = AudioWriter.open(path, { append: true });
    expect(reopened.bytesWritten).toBe(2 * FRAME_BYTES);
    reopened.close();
    expect(readHeader(path).dataSize).toBe(2 * FRAME_BYTES);
    expect(statSync(path).size).toBe(44 + 2 * FRAME_BYTES);
  });

  it("appends to an existing recording on resume", () => {
    const path = join(tempDir(), "resume.wav");
    const first = AudioWriter.open(path);
    first.write(frame(1));
    first.close();
    const second = AudioWriter.open(path, { append: true });
    expect(second.durationMs).toBe(100);
    second.write(frame(2));
    second.close();
    const header = readHeader(path);
    expect(header.dataSize).toBe(2 * FRAME_BYTES);
    expect(readFileSync(path)[44 + FRAME_BYTES]).toBe(2);
  });

  it("overwrites without append and repairs a truncated header file", () => {
    const path = join(tempDir(), "x.wav");
    writeFileSync(path, "junk");
    const writer = AudioWriter.open(path, { append: true });
    expect(writer.bytesWritten).toBe(0);
    writer.close();
    expect(readHeader(path).riff).toBe("RIFF");
  });

  it("refuses unsafe meeting ids in file names", () => {
    expect(() => wavPathFor("/data", "../etc/passwd")).toThrow();
    expect(wavPathFor("/data", "abc-123_X")).toBe("/data/abc-123_X.wav");
  });
});
