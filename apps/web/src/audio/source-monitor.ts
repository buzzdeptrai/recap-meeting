import type { MicState, SourceStatus, TabState } from "./capture-types";

/** Conditions the browser keeps "live" but that mean a channel is not delivering sound. */
export interface SourceFlags {
  tabMuted: boolean;
  tabSilent: boolean;
  micMuted: boolean;
  micSilent: boolean;
  micLost: boolean;
  /** Mic re-hearing the speakers (echo detector); advisory, ignored unless both sources are ok. */
  micEcho: boolean;
}

export const INITIAL_FLAGS: SourceFlags = {
  tabMuted: false,
  tabSilent: false,
  micMuted: false,
  micSilent: false,
  micLost: false,
  micEcho: false,
};

/** Overlays the live-but-dead flags on the base (track lifecycle) state; only "ok" can degrade. */
export function deriveStatus(base: SourceStatus, flags: SourceFlags): SourceStatus {
  const tab: TabState =
    base.tab === "ok" && (flags.tabMuted || flags.tabSilent) ? "silent" : base.tab;
  let mic: MicState = base.mic;
  if (base.mic === "ok" && flags.micLost) mic = "lost";
  else if (base.mic === "ok" && (flags.micMuted || flags.micSilent)) mic = "silent";
  const echo = tab === "ok" && mic === "ok" && flags.micEcho;
  return echo ? { tab, mic, echo } : { tab, mic };
}

/** True when the track's device is gone from the enumerated inputs (unknown id = not provable). */
export function isInputDeviceLost(
  deviceId: string | undefined,
  devices: MediaDeviceInfo[],
): boolean {
  if (!deviceId) return false;
  return !devices.some((device) => device.kind === "audioinput" && device.deviceId === deviceId);
}

export function sameFlags(a: SourceFlags, b: SourceFlags): boolean {
  return (Object.keys(a) as (keyof SourceFlags)[]).every((key) => a[key] === b[key]);
}

/** Calls `onChange(muted)` for mute/unmute events of the track; returns the cleanup. */
export function watchTrackMute(track: MediaStreamTrack, onChange: (muted: boolean) => void) {
  const onMute = () => onChange(true);
  const onUnmute = () => onChange(false);
  track.addEventListener("mute", onMute);
  track.addEventListener("unmute", onUnmute);
  return () => {
    track.removeEventListener("mute", onMute);
    track.removeEventListener("unmute", onUnmute);
  };
}

/** Calls `onChange(lost)` on every device change; returns the cleanup. */
export function watchMicDevice(track: MediaStreamTrack, onChange: (lost: boolean) => void) {
  const devices = navigator.mediaDevices;
  let detached = false;
  const check = async () => {
    try {
      const all = await devices.enumerateDevices();
      // An enumeration started for an old (detached) mic must not flag the new one.
      if (detached) return;
      onChange(isInputDeviceLost(track.getSettings().deviceId, all));
    } catch {
      // Enumeration can fail on a closing page; keep the previous state.
    }
  };
  devices.addEventListener("devicechange", check);
  return () => {
    detached = true;
    devices.removeEventListener("devicechange", check);
  };
}

/** Holds base status + flags and publishes the derived status only when it actually changes. */
export function createStatusPublisher(
  base: SourceStatus,
  onChange: (status: SourceStatus) => void,
) {
  let flags: SourceFlags = INITIAL_FLAGS;
  let lastKey = "";
  const publish = () => {
    const next = deriveStatus(base, flags);
    const key = `${next.tab}|${next.mic}|${next.echo ?? false}`;
    if (key === lastKey) return;
    lastKey = key;
    onChange(next);
  };
  const setFlags = (patch: Partial<SourceFlags>) => {
    const next = { ...flags, ...patch };
    if (sameFlags(next, flags)) return;
    flags = next;
    publish();
  };
  return { publish, setFlags };
}
