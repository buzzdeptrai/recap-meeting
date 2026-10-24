import {
  closeSync,
  existsSync,
  fstatSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  writeSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  BYTES_PER_PATCH_INTERVAL,
  DATA_SIZE_OFFSET,
  RIFF_OVERHEAD_BYTES,
  RIFF_SIZE_OFFSET,
  WAV_BLOCK_ALIGN,
  WAV_HEADER_BYTES,
  buildWavHeader,
  bytesToMs,
} from "./wav";

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const UINT32_BYTES = 4;

/** `<dir>/<meetingId>.wav`; rejects ids that could escape the directory. */
export function wavPathFor(dir: string, meetingId: string): string {
  if (!SAFE_ID.test(meetingId)) throw new Error("Unsafe meeting id for audio file name");
  return join(dir, `${meetingId}.wav`);
}

/**
 * Appends stereo 16 kHz PCM to a WAV file. A valid header is written up front and the size
 * fields are re-patched every few seconds and on close, so a crash leaves a file that is
 * playable up to the last patch and recoverable by reopening it (sizes derive from file length).
 */
export class AudioWriter {
  private position: number;
  private lastPatchBytes = 0;
  private closed = false;

  private constructor(
    private readonly fd: number,
    private dataBytes: number,
  ) {
    this.position = WAV_HEADER_BYTES + dataBytes;
    this.lastPatchBytes = dataBytes;
  }

  /** Creates the file, or with `append` continues an existing recording (fixing its header). */
  static open(path: string, options: { append?: boolean } = {}): AudioWriter {
    mkdirSync(dirname(path), { recursive: true });
    if (options.append && existsSync(path)) return AudioWriter.reopen(path);
    const fd = openSync(path, "w+");
    writeSync(fd, buildWavHeader(0), 0, WAV_HEADER_BYTES, 0);
    return new AudioWriter(fd, 0);
  }

  private static reopen(path: string): AudioWriter {
    const fd = openSync(path, "r+");
    const size = fstatSync(fd).size;
    if (size < WAV_HEADER_BYTES) {
      writeSync(fd, buildWavHeader(0), 0, WAV_HEADER_BYTES, 0);
      ftruncateSync(fd, WAV_HEADER_BYTES);
      return new AudioWriter(fd, 0);
    }
    // Drop a torn trailing sample frame left by a crash.
    const dataBytes = Math.floor((size - WAV_HEADER_BYTES) / WAV_BLOCK_ALIGN) * WAV_BLOCK_ALIGN;
    ftruncateSync(fd, WAV_HEADER_BYTES + dataBytes);
    const writer = new AudioWriter(fd, dataBytes);
    writer.patchHeader();
    return writer;
  }

  get bytesWritten(): number {
    return this.dataBytes;
  }

  get durationMs(): number {
    return bytesToMs(this.dataBytes);
  }

  write(frame: Uint8Array): void {
    if (this.closed) return;
    writeSync(this.fd, frame, 0, frame.length, this.position);
    this.position += frame.length;
    this.dataBytes += frame.length;
    if (this.dataBytes - this.lastPatchBytes >= BYTES_PER_PATCH_INTERVAL) this.patchHeader();
  }

  /** Finalises the header sizes and closes the file. Safe to call twice. */
  close(): void {
    if (this.closed) return;
    this.patchHeader();
    this.closed = true;
    closeSync(this.fd);
  }

  private patchHeader(): void {
    const field = Buffer.alloc(UINT32_BYTES);
    field.writeUInt32LE(RIFF_OVERHEAD_BYTES + this.dataBytes);
    writeSync(this.fd, field, 0, UINT32_BYTES, RIFF_SIZE_OFFSET);
    field.writeUInt32LE(this.dataBytes);
    writeSync(this.fd, field, 0, UINT32_BYTES, DATA_SIZE_OFFSET);
    this.lastPatchBytes = this.dataBytes;
  }
}
