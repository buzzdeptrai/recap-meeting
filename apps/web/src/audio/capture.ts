import { CHANNELS, FRAME_SAMPLES, SAMPLE_RATE } from "@recap/core";

export type TabState = "ok" | "missing" | "ended";
export type MicState = "ok" | "denied" | "ended";

export interface SourceStatus {
  tab: TabState;
  mic: MicState;
}

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

async function requestMicStream(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  } catch {
    return null;
  }
}

interface Graph {
  context: AudioContext;
  merger: ChannelMergerNode;
  node: AudioWorkletNode;
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
  node.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; levels: [number, number] }>) => {
    events.onFrame(event.data.pcm);
    events.onRms(event.data.levels[MIC_CHANNEL] ?? 0, event.data.levels[TAB_CHANNEL] ?? 0);
  };
  const mute = context.createGain();
  mute.gain.value = 0;
  merger.connect(node).connect(mute).connect(context.destination);
  return { context, merger, node };
}

/** Starts capture: tab (ch1) + mic (ch0) → worklet → frames. Must run inside a user gesture. */
export async function startCapture(events: CaptureEvents): Promise<CaptureSession> {
  if (!isSupported()) {
    throw new CaptureError(
      "unsupported",
      "Trình duyệt này không hỗ trợ ghi âm tab. Hãy dùng Chrome hoặc Edge.",
    );
  }
  const tabStream = await requestTabStream();
  const micStream = await requestMicStream();
  let graph: Graph;
  try {
    graph = await buildGraph(events);
  } catch (error) {
    stopTracks(tabStream);
    stopTracks(micStream);
    throw error;
  }
  return createSession(graph, events, tabStream, micStream);
}

const stopTracks = (stream: MediaStream | null) =>
  stream?.getTracks().forEach((track) => track.stop());

interface TabController {
  attach: (stream: MediaStream) => void;
  detach: () => void;
}

/** Owns the meeting-tab stream: wiring into the merger, "ended" detection, and cleanup. */
function createTabController(graph: Graph, status: SourceStatus, publish: () => void) {
  let tabStream: MediaStream | null = null;
  let tabSource: MediaStreamAudioSourceNode | null = null;

  const detach = () => {
    tabSource?.disconnect();
    tabSource = null;
    stopTracks(tabStream);
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

function createSession(
  graph: Graph,
  events: CaptureEvents,
  initialTab: MediaStream,
  micStream: MediaStream | null,
): CaptureSession {
  const status: SourceStatus = { tab: "missing", mic: micStream ? "ok" : "denied" };
  let stopped = false;
  const publish = () => events.onSourceChange({ ...status });
  const tab = createTabController(graph, status, publish);

  if (micStream) attachMic(graph, micStream, status, publish);
  tab.attach(initialTab);
  publish();

  return {
    stop() {
      stopped = true;
      tab.detach();
      stopTracks(micStream);
      void graph.context.close();
    },
    async reshareTab() {
      const stream = await requestTabStream();
      // The picker may resolve after stop(): release the new tracks instead of using a closed context.
      if (stopped) return stopTracks(stream);
      tab.attach(stream);
    },
  };
}

function attachMic(graph: Graph, stream: MediaStream, status: SourceStatus, publish: () => void) {
  const source = graph.context.createMediaStreamSource(stream);
  source.connect(graph.merger, 0, MIC_CHANNEL);
  stream.getAudioTracks()[0]?.addEventListener("ended", () => {
    status.mic = "ended";
    publish();
  });
}
