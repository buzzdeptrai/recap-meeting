import { CHANNELS, FRAME_MS, type UsageSink } from "@recap/core";

const MS_PER_SECOND = 1_000;
/** Long sessions flush a usage row this often so a crash loses at most this much. */
export const USAGE_FLUSH_INTERVAL_MS = 5 * 60 * 1_000;

export interface SttUsageMeterOptions {
  meetingId: string;
  sink: UsageSink;
  /** Billing vendor recorded on the usage rows. Defaults to deepgram. */
  vendor?: "deepgram" | "assemblyai";
  model: string;
  language: string;
  intervalMs?: number;
}

/**
 * Counts audio sent to the STT vendor and records it as usage. `audio_seconds` is always the
 * per-channel seconds summed over both channels, which is the right billing unit for both vendors:
 * Deepgram bills each channel separately, and AssemblyAI (one mono socket per channel) bills each
 * connection's session seconds, i.e. socket-seconds. The per-channel figure is kept in `meta`.
 * Each flush records only the frames since the last one.
 */
export class SttUsageMeter {
  private frames = 0;
  private flushes = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly options: SttUsageMeterOptions) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(
      () => this.flush("periodic"),
      this.options.intervalMs ?? USAGE_FLUSH_INTERVAL_MS,
    );
    this.timer.unref();
  }

  addFrame(count = 1): void {
    this.frames += count;
  }

  /** Stops the timer and records what is left. Safe to call more than once. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.flush("final");
  }

  private flush(kind: "periodic" | "final"): void {
    if (this.frames === 0) return;
    const perChannelSeconds = (this.frames * FRAME_MS) / MS_PER_SECOND;
    this.frames = 0;
    this.flushes += 1;
    try {
      this.options.sink({
        meetingId: this.options.meetingId,
        vendor: this.options.vendor ?? "deepgram",
        service: "stt_live",
        model: this.options.model,
        audioSeconds: perChannelSeconds * CHANNELS,
        requests: 1,
        status: "ok",
        meta: {
          channels: CHANNELS,
          perChannelSeconds,
          language: this.options.language,
          flush: kind,
          part: this.flushes,
        },
      });
    } catch {
      // the sink is fire-and-forget; metering must not disturb the session
    }
  }
}
