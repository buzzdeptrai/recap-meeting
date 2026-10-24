import type { Channel } from "@recap/core";

/** Provider connection state. Maps 1:1 to the `status.stt` protocol field. */
export type SttStatus = "connecting" | "open" | "reconnecting" | "closed";

/** `detect` = let the provider auto-detect the language (no fixed `language` param). */
export type SttLanguage = "vi" | "en" | "multi" | "detect";

export interface SttWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number | null;
}

/**
 * One transcript result for one audio channel. Times are integer ms on the audio timeline
 * (frame 0 of the session = 0), already corrected for reconnects.
 */
export interface SttResult {
  channel: Channel;
  text: string;
  startMs: number;
  endMs: number;
  words: SttWord[];
  /** Detected language code (e.g. "vi", "en") when the provider reports one. */
  lang: string | null;
}

export interface SttError {
  message: string;
  /** Fatal = provider gave up (no more reconnect attempts). */
  fatal: boolean;
}

/** Per-channel streaming state: `idle` = the channel is not being sent to the vendor (silence). */
export type SttChannelState = "active" | "idle";

export interface SttChannelActivity {
  channel: Channel;
  state: SttChannelState;
}

/** Optional usage hook for providers that may skip silent audio per channel. */
export interface SttUsageSource {
  /** Channel-frames (one FRAME_MS mono frame = 1) actually sent to the vendor since the last call. */
  takeSentChannelFrames(): number;
}

export interface SttEvents {
  interim: SttResult;
  final: SttResult;
  status: SttStatus;
  error: SttError;
  /** Only providers with silence gating emit this (AssemblyAI). */
  activity: SttChannelActivity;
}

export type SttListener<E extends keyof SttEvents> = (payload: SttEvents[E]) => void;

/** Streaming speech-to-text backend. Audio in: interleaved Int16 stereo PCM frames. */
export interface SttProvider {
  readonly name: string;
  /** Present only when the provider can skip audio, so billing must follow what was sent. */
  readonly usage?: SttUsageSource;
  /** Connects. Rejects if the first connection cannot be established. */
  open(): Promise<void>;
  /** Queues/sends one stereo PCM frame. Never throws; drops audio when closed. */
  sendAudio(frame: Uint8Array): void;
  /** Gracefully ends the stream; pending finals may still be emitted before it resolves. */
  close(): Promise<void>;
  /** Subscribes to an event; returns an unsubscribe function. */
  on<E extends keyof SttEvents>(event: E, listener: SttListener<E>): () => void;
}
