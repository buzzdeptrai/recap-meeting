import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INITIAL_FLAGS,
  deriveStatus,
  isInputDeviceLost,
  sameFlags,
  watchMicDevice,
} from "./source-monitor";

const input = (deviceId: string) => ({ kind: "audioinput", deviceId }) as MediaDeviceInfo;
const output = (deviceId: string) => ({ kind: "audiooutput", deviceId }) as MediaDeviceInfo;

describe("deriveStatus", () => {
  const ok = { tab: "ok", mic: "ok" } as const;

  it("keeps ok when no flag is set", () => {
    expect(deriveStatus(ok, INITIAL_FLAGS)).toEqual(ok);
  });

  it("maps muted or silent to silent", () => {
    expect(deriveStatus(ok, { ...INITIAL_FLAGS, tabMuted: true }).tab).toBe("silent");
    expect(deriveStatus(ok, { ...INITIAL_FLAGS, tabSilent: true }).tab).toBe("silent");
    expect(deriveStatus(ok, { ...INITIAL_FLAGS, micMuted: true }).mic).toBe("silent");
    expect(deriveStatus(ok, { ...INITIAL_FLAGS, micSilent: true }).mic).toBe("silent");
  });

  it("lost wins over silent for the mic", () => {
    expect(deriveStatus(ok, { ...INITIAL_FLAGS, micLost: true, micSilent: true }).mic).toBe("lost");
  });

  it("adds echo only while both sources are ok and leaves them untouched", () => {
    const flags = { ...INITIAL_FLAGS, micEcho: true };
    expect(deriveStatus(ok, flags)).toEqual({ tab: "ok", mic: "ok", echo: true });
    expect(deriveStatus(ok, { ...flags, micSilent: true })).toEqual({ tab: "ok", mic: "silent" });
    expect(deriveStatus(ok, { ...flags, tabSilent: true })).toEqual({ tab: "silent", mic: "ok" });
    expect(deriveStatus({ tab: "ended", mic: "ok" }, flags).echo).toBeUndefined();
  });

  it("never overrides a lifecycle state", () => {
    const base = { tab: "ended", mic: "denied" } as const;
    const flags = { ...INITIAL_FLAGS, tabMuted: true, micLost: true, micSilent: true };
    expect(deriveStatus(base, flags)).toEqual(base);
  });
});

describe("isInputDeviceLost", () => {
  it("is lost when the id is no longer an audio input", () => {
    expect(isInputDeviceLost("iphone", [input("builtin"), output("iphone")])).toBe(true);
  });
  it("is not lost while the id is listed", () => {
    expect(isInputDeviceLost("iphone", [input("iphone")])).toBe(false);
  });
  it("cannot prove a loss without an id", () => {
    expect(isInputDeviceLost(undefined, [])).toBe(false);
  });
});

describe("sameFlags", () => {
  it("compares every flag", () => {
    expect(sameFlags(INITIAL_FLAGS, { ...INITIAL_FLAGS })).toBe(true);
    expect(sameFlags(INITIAL_FLAGS, { ...INITIAL_FLAGS, micLost: true })).toBe(false);
  });
});

describe("watchMicDevice", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ignores an enumeration that resolves after the watcher was detached", async () => {
    let onDeviceChange: () => void = () => undefined;
    let resolveList: (devices: MediaDeviceInfo[]) => void = () => undefined;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        addEventListener: (_type: string, fn: () => void) => (onDeviceChange = fn),
        removeEventListener: vi.fn(),
        enumerateDevices: () => new Promise((resolve) => (resolveList = resolve)),
      },
    });
    const onChange = vi.fn();
    const track = { getSettings: () => ({ deviceId: "old" }) } as unknown as MediaStreamTrack;
    const stop = watchMicDevice(track, onChange);
    onDeviceChange();
    stop(); // the mic was swapped while enumerating
    resolveList([input("new")]);
    await Promise.resolve();
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
  });
});
