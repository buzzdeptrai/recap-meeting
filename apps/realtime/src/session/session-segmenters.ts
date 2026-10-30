import type { Segment, ServerMessage } from "@recap/core";
import { Segmenter, type GhostLineFilter, type RawSegment, type TimeRange } from "@recap/stt";
import { log } from "./safe";
import type { Guard } from "./session-guard";
import type { MeetingSessionOptions } from "./session-options";
import type { TranscriptRecorder } from "./transcript-recorder";

export interface SegmenterWiring {
  options: MeetingSessionOptions;
  recorder: TranscriptRecorder;
  ghostFilter: GhostLineFilter;
  guard: Guard;
  send: (message: ServerMessage) => void;
  /** Runs after a segment was persisted and sent (translation hook). */
  onCommitted: (segment: Segment) => void;
}

function commitSegment(wiring: SegmenterWiring, raw: RawSegment): void {
  let segment: Segment;
  try {
    segment = wiring.recorder.commit(raw);
  } catch (error) {
    log("failed to persist segment", error);
    wiring.send({ type: "error", code: "INTERNAL", message: "Could not save transcript segment" });
    return;
  }
  wiring.send({ type: "segment", segment });
  wiring.onCommitted(segment);
}

function sendInterim(wiring: SegmenterWiring, channel: 0 | 1, text: string, range: TimeRange) {
  const startMs = wiring.recorder.toMeetingMs(range.startMs);
  const endMs = Math.max(startMs, wiring.recorder.toMeetingMs(range.endMs));
  wiring.send({ type: "interim", channel, text, startMs, endMs });
}

/**
 * One segmenter per audio channel. Their callbacks fire from timers as well as STT events, so
 * both are guarded: an error ends this session (via `guard`), never the process.
 */
export function createSegmenters(wiring: SegmenterWiring): Segmenter[] {
  const { options, guard } = wiring;
  const variants = options.variants;
  return ([0, 1] as const).map(
    (channel) =>
      new Segmenter({
        channel,
        config: options.segmenterConfig,
        clock: options.clock,
        variants: variants ? () => variants : undefined,
        ghostFilter: wiring.ghostFilter,
        onSegment: guard("segment", (raw: RawSegment) => commitSegment(wiring, raw)),
        onInterim: guard("interim", (text: string, range: TimeRange) =>
          sendInterim(wiring, channel, text, range),
        ),
      }),
  );
}
