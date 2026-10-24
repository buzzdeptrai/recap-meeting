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

export interface SttEvents {
  interim: SttResult;
  final: SttResult;
  status: SttStatus;
  error: SttError;
}

export type SttListener<E extends keyof SttEvents> = (payload: SttEvents[E]) => void;

/** Streaming speech-to-text backend. Audio in: interleaved Int16 stereo PCM frames. */
export interface SttProvider {
  readonly name: string;
  /** Connects. Rejects if the first connection cannot be established. */
  open(): Promise<void>;
  /** Queues/sends one stereo PCM frame. Never throws; drops audio when closed. */
  sendAudio(frame: Uint8Array): void;
  /** Gracefully ends the stream; pending finals may still be emitted before it resolves. */
  close(): Promise<void>;
  /** Subscribes to an event; returns an unsubscribe function. */
  on<E extends keyof SttEvents>(event: E, listener: SttListener<E>): () => void;
}
