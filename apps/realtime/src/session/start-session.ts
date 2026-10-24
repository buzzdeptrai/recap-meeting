import type { StartMessage } from "@recap/core";
import type { Meeting } from "@recap/db";
import { AudioWriter, wavPathFor } from "../audio/audio-writer";
import { resolveSttLanguage, type RealtimeDeps } from "../deps";
import { MeetingSession } from "./meeting-session";
import { loadSttGlossary } from "./glossary-source";
import type { SessionSink } from "./types";

export class StartRefusedError extends Error {
  constructor(
    readonly code: "MEETING_NOT_FOUND" | "BAD_MESSAGE",
    message: string,
  ) {
    super(message);
  }
}

function checkStartable(deps: RealtimeDeps, message: StartMessage): Meeting {
  const meeting = deps.repos.meetings.get(message.meetingId);
  if (!meeting) throw new StartRefusedError("MEETING_NOT_FOUND", "Meeting not found");
  const recorded = deps.repos.segments.nextSeq(meeting.id) > 0 || meeting.status === "ended";
  if (recorded && !message.resume) {
    throw new StartRefusedError("BAD_MESSAGE", "Meeting already recorded; start with resume=true");
  }
  return meeting;
}

/**
 * Validates the request and builds a (not yet started) session. The registry slot is reserved
 * before returning and released when the session ends or construction fails.
 */
export function createMeetingSession(
  deps: RealtimeDeps,
  message: StartMessage,
  sink: SessionSink,
): MeetingSession {
  const meeting = checkStartable(deps, message);
  if (!deps.registry.reserve(meeting.id)) {
    throw new StartRefusedError("BAD_MESSAGE", "Meeting already has an active session");
  }
  let audio: AudioWriter | null = null;
  try {
    const glossary = loadSttGlossary(deps.repos);
    audio = AudioWriter.open(wavPathFor(deps.audioDir, meeting.id), {
      append: message.resume === true,
    });
    const session = new MeetingSession({
      meeting,
      repos: deps.repos,
      stt: deps.createStt({ sourceLang: message.sourceLang, keyterms: glossary.keyterms }),
      audio,
      sink,
      baseMs: message.resume ? audio.durationMs : 0,
      sourceLang: message.sourceLang,
      targetLang: message.targetLang,
      variants: glossary.variants,
      segmenterConfig: deps.segmenterConfigFor?.(message.sourceLang),
      usage: deps.usage && {
        sink: deps.usage.sink,
        vendor: deps.usage.sttVendor,
        model: deps.usage.sttModel,
        language: resolveSttLanguage(message.sourceLang, deps.usage.sttLanguage),
      },
      onEnded: () => deps.registry.release(meeting.id),
    });
    deps.registry.register(session);
    session.setHooks(deps.onSessionCreated?.(session) ?? {});
    return session;
  } catch (error) {
    audio?.close();
    deps.registry.release(meeting.id);
    throw error;
  }
}
