import { BYTES_PER_SAMPLE, CHANNELS, SAMPLE_RATE } from "@recap/core";

export const WAV_HEADER_BYTES = 44;
export const WAV_BLOCK_ALIGN = CHANNELS * BYTES_PER_SAMPLE;
/** Byte offsets of the two size fields patched while recording. */
export const RIFF_SIZE_OFFSET = 4;
export const DATA_SIZE_OFFSET = 40;
/** RIFF size = everything after the first 8 bytes = header (36) + data. */
export const RIFF_OVERHEAD_BYTES = WAV_HEADER_BYTES - 8;

const FMT_CHUNK_BYTES = 16;
const PCM_FORMAT = 1;
const BITS_PER_BYTE = 8;
const MS_PER_SECOND = 1_000;
const BYTES_PER_SECOND = SAMPLE_RATE * WAV_BLOCK_ALIGN;

/** Canonical 44-byte PCM WAV header (16 kHz, 16-bit, stereo) for `dataBytes` of audio. */
export function buildWavHeader(dataBytes: number): Buffer {
  const header = Buffer.alloc(WAV_HEADER_BYTES);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(RIFF_OVERHEAD_BYTES + dataBytes, RIFF_SIZE_OFFSET);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(FMT_CHUNK_BYTES, 16);
  header.writeUInt16LE(PCM_FORMAT, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(BYTES_PER_SECOND, 28);
  header.writeUInt16LE(WAV_BLOCK_ALIGN, 32);
  header.writeUInt16LE(BYTES_PER_SAMPLE * BITS_PER_BYTE, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataBytes, DATA_SIZE_OFFSET);
  return header;
}

export const bytesToMs = (bytes: number) => Math.round((bytes / BYTES_PER_SECOND) * MS_PER_SECOND);
export const BYTES_PER_PATCH_INTERVAL = BYTES_PER_SECOND * 5;
