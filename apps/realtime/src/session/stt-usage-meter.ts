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
 * Each flush records only the frames since the last one. Idle (silent, parked) channels send nothing
 * and therefore add nothing; `perChannelSeconds` is then the average over the channels.
 */
export class SttUsageMeter {
  /** Mono channel-frames (FRAME_MS each) sent to the vendor; a stereo frame = CHANNELS of them. */
  private channelFrames = 0;
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

  /** Stereo frames sent on every channel (Deepgram, or any provider without silence gating). */
  addFrame(count = 1): void {
    this.channelFrames += count * CHANNELS;
  }

  /** Mono channel-frames actually sent (providers that skip silent channels report these). */
  addChannelFrames(count: number): void {
    this.channelFrames += count;
  }

  /** Stops the timer and records what is left. Safe to call more than once. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.flush("final");
  }

  private flush(kind: "periodic" | "final"): void {
    if (this.channelFrames === 0) return;
    const audioSeconds = (this.channelFrames * FRAME_MS) / MS_PER_SECOND;
    const perChannelSeconds = audioSeconds / CHANNELS;
    this.channelFrames = 0;
    this.flushes += 1;
    try {
      this.options.sink({
        meetingId: this.options.meetingId,
        vendor: this.options.vendor ?? "deepgram",
        service: "stt_live",
        model: this.options.model,
        audioSeconds,
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
