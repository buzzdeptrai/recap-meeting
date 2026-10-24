import { createSttProvider, type SttLanguage, type SttResult } from "@recap/stt";

const FRAME_MS = 100;
const SETTLE_AFTER_CLOSE_MS = 500;

export interface SttRunConfig {
  language: SttLanguage;
  apiKey: string;
  model: string;
}

export interface SttRun {
  language: SttLanguage;
  ok: boolean;
  error: string | null;
  transcript: string;
  finals: number;
  /** Wall ms from the first audio frame to the first final. */
  firstFinalMs: number | null;
  /** Mean wall ms between a final's audio end and its arrival (scaled by speed). */
  avgFinalLagMs: number | null;
  wallMs: number;
  detectedLanguages: string[];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Sorted by audio time so both channels read in spoken order. */
export const joinTranscript = (finals: readonly SttResult[]): string =>
  [...finals]
    .sort((a, b) => a.startMs - b.startMs)
    .map((r) => r.text)
    .join(" ");

async function pace(
  frames: readonly Uint8Array[],
  speed: number,
  send: (frame: Uint8Array) => void,
): Promise<void> {
  const startedAt = Date.now();
  for (const [index, frame] of frames.entries()) {
    send(frame);
    if (Number.isFinite(speed))
      await sleep(startedAt + ((index + 1) * FRAME_MS) / speed - Date.now());
    else if (index % 20 === 19) await sleep(1);
  }
}

/** Streams the frames through the real Deepgram provider with one language setting. */
export async function runDeepgram(
  config: SttRunConfig,
  frames: readonly Uint8Array[],
  speed: number,
): Promise<SttRun> {
  const provider = createSttProvider({ provider: "deepgram", ...config });
  const finals: SttResult[] = [];
  const lags: number[] = [];
  const startedAt = Date.now();
  let firstFinalMs: number | null = null;
  let streamError: string | null = null;
  provider.on("error", (error) => {
    streamError ??= error.message;
  });
  provider.on("final", (result) => {
    const elapsed = Date.now() - startedAt;
    firstFinalMs ??= elapsed;
    lags.push(elapsed - (Number.isFinite(speed) ? result.endMs / speed : 0));
    finals.push(result);
  });
  try {
    await provider.open();
    await pace(frames, speed, (frame) => provider.sendAudio(frame));
    await provider.close();
    await sleep(SETTLE_AFTER_CLOSE_MS);
  } catch (error) {
    streamError ??= error instanceof Error ? error.message : String(error);
  }
  const sum = lags.reduce((total, lag) => total + lag, 0);
  return {
    language: config.language,
    ok: streamError === null,
    error: streamError,
    transcript: joinTranscript(finals),
    finals: finals.length,
    firstFinalMs,
    avgFinalLagMs: lags.length && Number.isFinite(speed) ? Math.round(sum / lags.length) : null,
    wallMs: Date.now() - startedAt,
    detectedLanguages: [...new Set(finals.map((r) => r.lang).filter((l): l is string => !!l))],
  };
}
