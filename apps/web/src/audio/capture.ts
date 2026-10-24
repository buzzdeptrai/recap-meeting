import { CHANNELS, FRAME_SAMPLES, SAMPLE_RATE } from "@recap/core";

import { createLevelMonitor, type LevelMonitor } from "./level-monitor";
import type { SourceStatus } from "./capture-types";
import { createMicController } from "./mic-controller";
import { openMicStream, stopStream } from "./mic-stream";
import { createStatusPublisher, watchTrackMute, type SourceFlags } from "./source-monitor";

export type { MicState, SourceStatus, TabState } from "./capture-types";

export interface CaptureEvents {
  /** One 100 ms interleaved stereo Int16 frame (FRAME_BYTES). */
  onFrame: (frame: ArrayBuffer) => void;
  /** Per-frame RMS (0..1): [mic, tab]. */
  onRms: (mic: number, tab: number) => void;
  onSourceChange: (status: SourceStatus) => void;
}

export interface CaptureSession {
  stop: () => void;
  /** Ask for the tab again (after "Dừng chia sẻ" or when audio was not ticked). */
  reshareTab: () => Promise<void>;
  /** Replace the microphone without stopping the session; false when the device could not be opened. */
  switchMic: (deviceId: string) => Promise<boolean>;
  /** Device id of the mic in use (null when unknown or no mic). */
  micDeviceId: () => string | null;
}

export type CaptureErrorCode = "unsupported" | "share-cancelled" | "worklet-failed";

export class CaptureError extends Error {
  constructor(
    readonly code: CaptureErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const WORKLET_URL = "/worklets/pcm-encoder.js";
const WORKLET_NAME = "pcm-encoder";
const MIC_CHANNEL = 0;
const TAB_CHANNEL = 1;

function isSupported(): boolean {
  const devices = navigator.mediaDevices as MediaDevices | undefined;
  return (
    typeof devices?.getDisplayMedia === "function" && typeof devices.getUserMedia === "function"
  );
}

/** Chrome/Edge need video:true to show the tab picker; only the audio is kept. */
async function requestTabStream(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    stream.getVideoTracks().forEach((track) => track.stop());
    return stream;
  } catch {
    throw new CaptureError(
      "share-cancelled",
      "Chưa chọn tab cuộc họp. Bấm Bắt đầu ghi và chọn đúng tab để tiếp tục.",
    );
  }
}

interface Graph {
  context: AudioContext;
  merger: ChannelMergerNode;
  node: AudioWorkletNode;
  /** Level tap, replaced by the session so silence detection sees every frame. */
  onLevels: (mic: number, tab: number) => void;
}

async function buildGraph(events: CaptureEvents): Promise<Graph> {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
  try {
    await context.audioWorklet.addModule(WORKLET_URL);
  } catch {
    void context.close();
    throw new CaptureError(
      "worklet-failed",
      "Không khởi tạo được bộ xử lý âm thanh của trình duyệt.",
    );
  }
  const merger = context.createChannelMerger(CHANNELS);
  const node = new AudioWorkletNode(context, WORKLET_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: CHANNELS,
    channelCountMode: "explicit",
    channelInterpretation: "discrete",
    processorOptions: { targetRate: SAMPLE_RATE, frameSamples: FRAME_SAMPLES },
  });
  const graph: Graph = { context, merger, node, onLevels: events.onRms };
  node.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; levels: [number, number] }>) => {
    events.onFrame(event.data.pcm);
    graph.onLevels(event.data.levels[MIC_CHANNEL] ?? 0, event.data.levels[TAB_CHANNEL] ?? 0);
  };
  const mute = context.createGain();
  mute.gain.value = 0;
  merger.connect(node).connect(mute).connect(context.destination);
  return graph;
}

/** Starts capture: tab (ch1) + mic (ch0) → worklet → frames. Must run inside a user gesture. */
export async function startCapture(
  events: CaptureEvents,
  micDeviceId?: string | null,
): Promise<CaptureSession> {
  if (!isSupported()) {
    throw new CaptureError(
      "unsupported",
      "Trình duyệt này không hỗ trợ ghi âm tab. Hãy dùng Chrome hoặc Edge.",
    );
  }
  const tabStream = await requestTabStream();
  const micStream = await openMicStream(micDeviceId);
  let graph: Graph;
  try {
    graph = await buildGraph(events);
  } catch (error) {
    stopStream(tabStream);
    stopStream(micStream);
    throw error;
  }
  return createSession(graph, events, tabStream, micStream);
}

interface TabController {
  attach: (stream: MediaStream) => void;
  detach: () => void;
}

/** Owns the meeting-tab stream: wiring into the merger, "ended" detection, and cleanup. */
function createTabController(
  graph: Graph,
  status: SourceStatus,
  setMuted: (muted: boolean) => void,
  publish: () => void,
) {
  let tabStream: MediaStream | null = null;
  let tabSource: MediaStreamAudioSourceNode | null = null;
  let unwatchMute: (() => void) | null = null;

  const detach = () => {
    unwatchMute?.();
    unwatchMute = null;
    tabSource?.disconnect();
    tabSource = null;
    stopStream(tabStream);
    tabStream = null;
  };

  const attach = (stream: MediaStream) => {
    detach();
    tabStream = stream;
    const audio = stream.getAudioTracks()[0];
    if (!audio) {
      status.tab = "missing";
      return publish();
    }
    tabSource = graph.context.createMediaStreamSource(new MediaStream([audio]));
    tabSource.connect(graph.merger, 0, TAB_CHANNEL);
    unwatchMute = watchTrackMute(audio, setMuted);
    setMuted(audio.muted);
    audio.addEventListener("ended", () => {
      if (tabStream !== stream) return;
      detach();
      status.tab = "ended";
      publish();
    });
    status.tab = "ok";
    publish();
  };
  return { attach, detach } satisfies TabController;
}

/** Routes every frame's levels to the meters and to the silence/echo monitor. */
function wireLevels(
  graph: Graph,
  events: CaptureEvents,
  monitor: LevelMonitor,
  setFlags: (patch: Partial<SourceFlags>) => void,
): void {
  graph.onLevels = (mic, tab) => {
    events.onRms(mic, tab);
    setFlags(monitor.feed(mic, tab));
  };
}

export function createSession(
  graph: Graph,
  events: CaptureEvents,
  initialTab: MediaStream,
  micStream: MediaStream | null,
): CaptureSession {
  const base: SourceStatus = { tab: "missing", mic: "denied" };
  let stopped = false;
  const monitor = createLevelMonitor();
  const { publish, setFlags } = createStatusPublisher(base, events.onSourceChange);
  wireLevels(graph, events, monitor, setFlags);

  const tab = createTabController(
    graph,
    base,
    (tabMuted) => {
      monitor.resetTab();
      setFlags({ tabMuted, tabSilent: false });
    },
    publish,
  );
  const mic = createMicController({
    graph,
    status: base,
    setFlags,
    publish,
    resetSilence: monitor.resetMic,
    isActive: () => !stopped,
  });
  mic.attach(micStream);
  tab.attach(initialTab);
  publish();

  return {
    stop() {
      if (stopped) return; // idempotent: a second close() would reject on a closed context
      stopped = true;
      tab.detach();
      mic.detach();
      graph.context.close().catch(() => undefined);
    },
    async reshareTab() {
      const stream = await requestTabStream();
      // The picker may resolve after stop(): release the new tracks instead of using a closed context.
      if (stopped) return stopStream(stream);
      tab.attach(stream);
    },
    switchMic: mic.switchTo,
    micDeviceId: mic.activeDeviceId,
  };
}
