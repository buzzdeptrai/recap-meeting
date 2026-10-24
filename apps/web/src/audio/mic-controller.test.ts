import { afterEach, describe, expect, it, vi } from "vitest";
import type { SourceStatus } from "./capture-types";
import { createMicController } from "./mic-controller";

function fakeTrack(deviceId: string) {
  const listeners = new Map<string, () => void>();
  return {
    muted: false,
    stop: vi.fn(),
    getSettings: () => ({ deviceId }),
    addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
    emit: (type: string) => listeners.get(type)?.(),
  };
}

function fakeStream(track: ReturnType<typeof fakeTrack>) {
  return { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
}

function stubDevices(
  getUserMedia: () => Promise<MediaStream> = () => Promise.reject(new Error("unused")),
) {
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(getUserMedia),
      enumerateDevices: vi.fn().mockResolvedValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

function setup(isActive = () => true) {
  stubDevices();
  vi.stubGlobal("MediaStream", function (tracks: unknown[]) {
    return fakeStream(tracks[0] as ReturnType<typeof fakeTrack>);
  });
  const sources: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const graph = {
    merger: {},
    context: {
      createMediaStreamSource: () => {
        const source = { connect: vi.fn(), disconnect: vi.fn() };
        sources.push(source);
        return source;
      },
    },
  } as unknown as Parameters<typeof createMicController>[0]["graph"];
  const status: SourceStatus = { tab: "ok", mic: "denied" };
  const flags: Record<string, boolean> = {};
  const deps = {
    graph,
    status,
    setFlags: vi.fn((patch: Record<string, boolean>) => Object.assign(flags, patch)),
    publish: vi.fn(),
    resetSilence: vi.fn(),
    isActive,
  };
  return { controller: createMicController(deps), deps, sources, status, flags };
}

describe("createMicController", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("attach wires channel 0, resets silence and marks ok", () => {
    const { controller, deps, sources, status } = setup();
    controller.attach(fakeStream(fakeTrack("a")));
    expect(sources[0]?.connect).toHaveBeenCalledWith(deps.graph.merger, 0, 0);
    expect(deps.resetSilence).toHaveBeenCalled();
    expect(status.mic).toBe("ok");
    expect(controller.activeDeviceId()).toBe("a");
  });

  it("attach(null) reports denied", () => {
    const { controller, status } = setup();
    controller.attach(null);
    expect(status.mic).toBe("denied");
  });

  it("ended track flips status to ended", () => {
    const { controller, status } = setup();
    const track = fakeTrack("a");
    controller.attach(fakeStream(track));
    track.emit("ended");
    expect(status.mic).toBe("ended");
  });

  it("switchTo replaces the old source and tracks, and clears lost/silent flags", async () => {
    const { controller, sources, status, flags } = setup();
    const oldTrack = fakeTrack("a");
    controller.attach(fakeStream(oldTrack));
    status.mic = "ended";
    flags.micLost = true;
    const newTrack = fakeTrack("b");
    stubDevices(() => Promise.resolve(fakeStream(newTrack)));
    expect(await controller.switchTo("b")).toBe(true);
    expect(sources[0]?.disconnect).toHaveBeenCalled();
    expect(oldTrack.stop).toHaveBeenCalled();
    expect(status.mic).toBe("ok");
    expect(flags).toMatchObject({ micLost: false, micSilent: false });
    expect(controller.activeDeviceId()).toBe("b");
  });

  it("switchTo keeps the old mic when the device cannot be opened", async () => {
    const { controller, sources } = setup();
    controller.attach(fakeStream(fakeTrack("a")));
    stubDevices(() => Promise.reject(new Error("busy")));
    expect(await controller.switchTo("b")).toBe(false);
    expect(sources[0]?.disconnect).not.toHaveBeenCalled();
    expect(controller.activeDeviceId()).toBe("a");
  });

  it("switchTo releases the new stream when the session stopped meanwhile", async () => {
    const { controller, sources } = setup(() => false);
    const newTrack = fakeTrack("b");
    stubDevices(() => Promise.resolve(fakeStream(newTrack)));
    expect(await controller.switchTo("b")).toBe(false);
    expect(newTrack.stop).toHaveBeenCalled();
    expect(sources).toHaveLength(0);
  });

  it("the last switchTo request wins even when an earlier one resolves later", async () => {
    const { controller } = setup();
    const slowTrack = fakeTrack("slow");
    const fastTrack = fakeTrack("fast");
    let releaseSlow: (stream: MediaStream) => void = () => undefined;
    stubDevices(() => new Promise<MediaStream>((resolve) => (releaseSlow = resolve)));
    const first = controller.switchTo("slow");
    stubDevices(() => Promise.resolve(fakeStream(fastTrack)));
    const second = controller.switchTo("fast");
    expect(await second).toBe(true);
    releaseSlow(fakeStream(slowTrack));
    expect(await first).toBe(false);
    expect(slowTrack.stop).toHaveBeenCalled();
    expect(fastTrack.stop).not.toHaveBeenCalled();
    expect(controller.activeDeviceId()).toBe("fast");
  });
});
