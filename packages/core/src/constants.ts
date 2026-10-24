/** Audio format shared by the browser encoder, realtime server and STT provider. */
export const SAMPLE_RATE = 16_000;
export const CHANNELS = 2;
export const BYTES_PER_SAMPLE = 2;
export const FRAME_MS = 100;
const MS_PER_SECOND = 1_000;
/** Samples per channel in one frame (1600). */
export const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / MS_PER_SECOND;
/** Bytes in one interleaved Int16 stereo frame (6400). */
export const FRAME_BYTES = FRAME_SAMPLES * CHANNELS * BYTES_PER_SAMPLE;

/** Channel 0 = local mic ("Tôi"). */
export const CHANNEL_ME = 0;
/** Channel 1 = meeting tab audio ("Người khác"). */
export const CHANNEL_OTHERS = 1;

export const WS_PATH = "/ws";
export const HEALTH_PATH = "/health";

/**
 * "Conclusion mark" window: the transcript around a mark that counts as the decision. People
 * press the mark after the decision was spoken, so the window leans backwards. Shared by the
 * minutes generator (server env can override) and the room UI highlight (always the defaults).
 */
export const MARK_WINDOW_BEFORE_MS = 90_000;
export const MARK_WINDOW_AFTER_MS = 15_000;
