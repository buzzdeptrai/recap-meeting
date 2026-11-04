import { buildGraph, CaptureError, type Graph } from "./capture";
import type { MicState } from "./capture-types";
import { isCaptureInterrupted, trackHealth } from "./interruption";
import { createLevelMonitor } from "./level-monitor";
import { createMicController } from "./mic-controller";
import { openMicStream, stopStream } from "./mic-stream";
import { stereoToMono } from "./pcm";
import { createStatusPublisher } from "./source-monitor";

/** Mic-only capture for phones: one channel, mono frames, no tab sharing. */
export interface MicCaptureEvents {
  /** One 100 ms mono Int16 frame (MONO_FRAME_BYTES). */
  onFrame: (frame: ArrayBuffer) => void;
  /** Per-frame RMS (0..1) of the mic. */
  onRms: (level: number) => void;
  onMicChange: (mic: MicState) => void;
  /** Capture stopped delivering sound without the user stopping it (lock, call, Siri, background). */
  onInterrupted: (interrupted: boolean) => void;
}

export interface MicCaptureOptions {
  /** Pre-created context from `unlockAudio()`; made on the spot when absent. */
  context?: AudioContext | null;
}

export interface MicCaptureSession {
  stop: () => void;
  /** Resumes the context and re-opens the mic after an interruption; false when it did not work. */
  restart: () => Promise<boolean>;
}

/** How often the health of the mic track / context is re-read (events on iOS are unreliable). */
export const HEALTH_POLL_MS = 1_000;

let unlocked: AudioContext | null = null;

/**
 * Creates and resumes the AudioContext. iOS Safari only lets a context run when it is created or
 * resumed inside a user gesture, so call this synchronously from the Start button's click handler
 * (before any `await`); the context is picked up by the next `startMicCapture`. It runs at the
 * device rate (48k / 44.1k): the worklet resamples to 16 kHz, which also avoids the Safari error
 * for a media stream source whose rate differs from the context's.
 */
export function unlockAudio(): void {
  unlocked?.close().catch(() => undefined);
  unlocked = null;
  if (typeof AudioContext === "undefined") return;
  unlocked = new AudioContext({ latencyHint: "interactive" });
  unlocked.resume().catch(() => undefined);
}

function takeContext(options: MicCaptureOptions): AudioContext {
  const context = options.context ?? unlocked ?? new AudioContext({ latencyHint: "interactive" });
  if (context === unlocked) unlocked = null;
  return context;
}

/** Starts mic-only capture. Call from (or right after) a user gesture. */
export async function startMicCapture(
  events: MicCaptureEvents,
  options: MicCaptureOptions = {},
): Promise<MicCaptureSession> {
  const devices = navigator.mediaDevices as MediaDevices | undefined;
  if (typeof devices?.getUserMedia !== "function" || typeof AudioContext === "undefined") {
    throw new CaptureError(
      "unsupported",
      "Trình duyệt này không ghi âm được. Hãy dùng Safari hoặc Chrome mới.",
    );
  }
  const context = takeContext(options);
  const stream = await openMicStream(null);
  if (!stream) {
    context.close().catch(() => undefined);
    throw new CaptureError(
      "mic-denied",
      "Chưa cấp quyền micro. Cho phép micro cho trang này trong cài đặt trình duyệt rồi thử lại.",
    );
  }
  const health: FrameClock = { lastFrameAt: null };
  const graph = await buildGraph(
    {
      onFrame: (pcm) => {
        health.lastFrameAt = performance.now();
        events.onFrame(stereoToMono(pcm));
      },
      onRms: events.onRms,
      onSourceChange: () => undefined,
    },
    { context },
  ).catch((error: unknown) => {
    stopStream(stream);
    throw error;
  });
  return createSession({ graph, stream, events, health });
}

/** When the last frame arrived (performance.now), shared between the worklet callback and the checks. */
interface FrameClock {
  lastFrameAt: number | null;
}

interface SessionDeps {
  graph: Graph;
  stream: MediaStream;
  events: MicCaptureEvents;
  health: FrameClock;
}

function createSession({ graph, stream, events, health }: SessionDeps): MicCaptureSession {
  const base = { tab: "missing", mic: "denied" } as const;
  const status = { ...base };
  let stopped = false;
  const monitor = createLevelMonitor();
  const { publish, setFlags } = createStatusPublisher(status, (next) =>
    events.onMicChange(next.mic),
  );
  graph.onLevels = (mic, tab) => {
    events.onRms(mic);
    setFlags(monitor.feed(mic, tab));
  };
  const mic = createMicController({
    graph,
    status,
    setFlags,
    publish,
    resetSilence: monitor.resetMic,
    isActive: () => !stopped,
  });
  mic.attach(stream);

  const watcher = watchInterruption({
    context: graph.context,
    track: mic.activeTrack,
    health,
    onChange: events.onInterrupted,
    isStopped: () => stopped,
  });

  return {
    stop() {
      if (stopped) return; // idempotent: a second close() would reject on a closed context
      stopped = true;
      watcher.dispose();
      mic.detach();
      graph.context.close().catch(() => undefined);
    },
    async restart() {
      if (stopped || graph.context.state === "closed") return false;
      await graph.context.resume().catch(() => undefined);
      const reopened = await mic.switchTo(null);
      health.lastFrameAt = performance.now(); // give the audio thread a fresh stall window
      watcher.check();
      return reopened && !watcher.interrupted();
    },
  };
}

interface WatchDeps {
  context: AudioContext;
  track: () => MediaStreamTrack | null;
  health: FrameClock;
  onChange: (interrupted: boolean) => void;
  isStopped: () => boolean;
}

/** Re-reads the capture health on a timer and on statechange / visibilitychange (iOS events are unreliable). */
function watchInterruption({ context, track, health, onChange, isStopped }: WatchDeps) {
  let interrupted = false;
  const check = () => {
    if (isStopped()) return;
    const { lastFrameAt } = health;
    const next = isCaptureInterrupted({
      ...trackHealth(track()),
      contextState: context.state,
      msSinceFrame: lastFrameAt === null ? null : performance.now() - lastFrameAt,
    });
    if (next === interrupted) return;
    interrupted = next;
    onChange(next);
  };
  const timer = setInterval(check, HEALTH_POLL_MS);
  context.addEventListener("statechange", check);
  document.addEventListener("visibilitychange", check);
  return {
    check,
    interrupted: () => interrupted,
    dispose() {
      clearInterval(timer);
      context.removeEventListener("statechange", check);
      document.removeEventListener("visibilitychange", check);
    },
  };
}
