import type { SourceStatus } from "./capture-types";
import { openMicStream, stopStream } from "./mic-stream";
import { watchMicDevice, watchTrackMute, type SourceFlags } from "./source-monitor";

const MIC_CHANNEL = 0;

interface MicGraph {
  context: AudioContext;
  merger: ChannelMergerNode;
}

interface MicDeps {
  graph: MicGraph;
  status: SourceStatus;
  setFlags: (patch: Partial<SourceFlags>) => void;
  publish: () => void;
  /** Gives the mic channel a fresh silence window (new device = new history). */
  resetSilence: () => void;
  /** False once the session was stopped (a pending hot-swap must then release its stream). */
  isActive: () => boolean;
}

export interface MicController {
  /** Wires an already-open stream (null = permission denied). */
  attach: (stream: MediaStream | null) => void;
  /** Hot-swap to another device; false when it could not be opened (the old mic is kept). */
  switchTo: (deviceId: string) => Promise<boolean>;
  /** Device id of the live mic track, if known. */
  activeDeviceId: () => string | null;
  detach: () => void;
}

interface TrackHooks {
  onEnded: () => void;
  setFlags: (patch: Partial<SourceFlags>) => void;
}

/** Ended + mute + devicechange watchers for one mic track; returns the combined cleanup. */
function watchTrack(track: MediaStreamTrack, hooks: TrackHooks): () => void {
  track.addEventListener("ended", hooks.onEnded);
  const stopMute = watchTrackMute(track, (micMuted) => hooks.setFlags({ micMuted }));
  const stopDevice = watchMicDevice(track, (micLost) => hooks.setFlags({ micLost }));
  return () => {
    track.removeEventListener("ended", hooks.onEnded);
    stopMute();
    stopDevice();
  };
}

async function openCurrentMic(
  deviceId: string,
  isCurrent: () => boolean,
): Promise<MediaStream | null> {
  const next = await openMicStream(deviceId, false);
  if (next && !isCurrent()) stopStream(next);
  return next && isCurrent() ? next : null;
}

/** Owns the mic stream: wiring into merger channel 0, mute/ended/devicechange watchers, hot-swap. */
export function createMicController(deps: MicDeps): MicController {
  const { graph, status, setFlags, publish, resetSilence, isActive } = deps;
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let unwatch: (() => void) | null = null;
  let switchSeq = 0;

  const detach = () => {
    unwatch?.();
    unwatch = null;
    source?.disconnect();
    source = null;
    stopStream(stream);
    stream = null;
  };

  const attach = (next: MediaStream | null) => {
    detach();
    const track = next?.getAudioTracks()[0];
    if (!next || !track) {
      stopStream(next);
      status.mic = "denied";
      return publish();
    }
    stream = next;
    source = graph.context.createMediaStreamSource(new MediaStream([track]));
    source.connect(graph.merger, 0, MIC_CHANNEL);
    unwatch = watchTrack(track, {
      onEnded: () => {
        if (stream !== next) return;
        status.mic = "ended";
        publish();
      },
      setFlags,
    });
    resetSilence();
    setFlags({ micMuted: track.muted, micLost: false, micSilent: false });
    status.mic = "ok";
    publish();
  };

  const switchTo = async (deviceId: string) => {
    const seq = ++switchSeq;
    // The last request wins: a superseded (or post-stop) result releases its stream.
    const next = await openCurrentMic(deviceId, () => isActive() && seq === switchSeq);
    if (!next) return false;
    attach(next);
    return true;
  };

  const activeDeviceId = () => stream?.getAudioTracks()[0]?.getSettings().deviceId ?? null;
  return { attach, switchTo, activeDeviceId, detach };
}
