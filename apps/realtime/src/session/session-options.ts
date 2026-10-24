import type { Meeting, Repositories } from "@recap/db";
import type { Clock, SegmenterConfig, SttProvider, VariantEntry } from "@recap/stt";
import type { AudioWriter } from "../audio/audio-writer";
import type { SttRetryOptions } from "./stt-retry";
import type { SttUsageMeterOptions } from "./stt-usage-meter";
import type { SessionHooks, SessionLanguages, SessionSink } from "./types";

export interface MeetingSessionOptions extends SessionLanguages {
  meeting: Meeting;
  repos: Repositories;
  stt: SttProvider;
  audio: AudioWriter;
  sink: SessionSink;
  /** Session audio timeline → meeting timeline offset (non-zero when resuming). */
  baseMs: number;
  variants?: readonly VariantEntry[];
  hooks?: SessionHooks;
  segmenterConfig?: Partial<SegmenterConfig>;
  clock?: Clock;
  /** Enables Deepgram usage metering for this session. */
  usage?: Omit<SttUsageMeterOptions, "meetingId">;
  /** Overrides for the manual STT retry guard (tests). */
  sttRetry?: SttRetryOptions;
  /** Invoked once at the very end of `stop()` (e.g. to release the registry slot). */
  onEnded?: () => void;
}
