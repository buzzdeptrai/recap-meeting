import { afterEach, describe, expect, it, vi } from "vitest";
import { openMicStream, stopStream } from "./mic-stream";

const stream = { id: "s" } as unknown as MediaStream;

function stubGetUserMedia(impl: (constraints: MediaStreamConstraints) => Promise<MediaStream>) {
  const getUserMedia = vi.fn(impl);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  return getUserMedia;
}

describe("openMicStream", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the exact device when an id is given", async () => {
    const gum = stubGetUserMedia(async () => stream);
    expect(await openMicStream("dev1")).toBe(stream);
    const audio = gum.mock.calls[0]?.[0].audio as MediaTrackConstraints;
    expect(audio.deviceId).toEqual({ exact: "dev1" });
  });

  it("uses the default device without an id", async () => {
    const gum = stubGetUserMedia(async () => stream);
    await openMicStream(null);
    const audio = gum.mock.calls[0]?.[0].audio as MediaTrackConstraints;
    expect(audio.deviceId).toBeUndefined();
  });

  it("falls back to the default when the exact device fails", async () => {
    const gum = stubGetUserMedia(async (constraints) => {
      const audio = constraints.audio as MediaTrackConstraints;
      if (audio.deviceId) throw new DOMException("gone", "OverconstrainedError");
      return stream;
    });
    expect(await openMicStream("gone")).toBe(stream);
    expect(gum).toHaveBeenCalledTimes(2);
  });

  it("does not fall back when fallbackToDefault is false", async () => {
    const gum = stubGetUserMedia(async () => {
      throw new Error("denied");
    });
    expect(await openMicStream("gone", false)).toBeNull();
    expect(gum).toHaveBeenCalledTimes(1);
  });

  it("returns null when even the default is refused", async () => {
    stubGetUserMedia(async () => {
      throw new Error("denied");
    });
    expect(await openMicStream("x")).toBeNull();
  });
});

describe("stopStream", () => {
  it("stops every track and tolerates null", () => {
    const stop = vi.fn();
    stopStream({ getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(() => stopStream(null)).not.toThrow();
  });
});
