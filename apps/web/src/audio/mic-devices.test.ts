import { afterEach, describe, expect, it, vi } from "vitest";
import { listMicInputs, otherMics, resolveMicChoice, toMicOptions } from "./mic-devices";

const device = (kind: string, deviceId: string, label = "") =>
  ({ kind, deviceId, label }) as MediaDeviceInfo;

describe("toMicOptions", () => {
  it("keeps only audio inputs and drops default/communications aliases", () => {
    const result = toMicOptions([
      device("audioinput", "default", "Default - Built-in"),
      device("audioinput", "communications", "Communications"),
      device("audioinput", "a", "Built-in Mic"),
      device("audiooutput", "o", "Speakers"),
      device("videoinput", "v", "Camera"),
    ]);
    expect(result).toEqual([{ deviceId: "a", label: "Built-in Mic" }]);
  });

  it("numbers inputs whose label is hidden (no permission yet)", () => {
    const result = toMicOptions([device("audioinput", "a"), device("audioinput", "b", "  ")]);
    expect(result.map((option) => option.label)).toEqual(["Micro 1", "Micro 2"]);
  });
});

describe("resolveMicChoice", () => {
  const options = [{ deviceId: "a", label: "A" }];
  it("returns the saved id only while it still exists", () => {
    expect(resolveMicChoice("a", options)).toBe("a");
    expect(resolveMicChoice("gone", options)).toBeNull();
    expect(resolveMicChoice(null, options)).toBeNull();
  });
});

describe("otherMics", () => {
  it("excludes the active device", () => {
    const options = [
      { deviceId: "a", label: "A" },
      { deviceId: "b", label: "B" },
    ];
    expect(otherMics(options, "a")).toEqual([{ deviceId: "b", label: "B" }]);
    expect(otherMics(options, null)).toHaveLength(2);
  });
});

describe("listMicInputs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("enumerates through navigator.mediaDevices", async () => {
    const enumerateDevices = vi.fn().mockResolvedValue([device("audioinput", "a", "Mic")]);
    vi.stubGlobal("navigator", { mediaDevices: { enumerateDevices } });
    expect(await listMicInputs()).toEqual([{ deviceId: "a", label: "Mic" }]);
  });

  it("returns an empty list when unsupported or failing", async () => {
    vi.stubGlobal("navigator", {});
    expect(await listMicInputs()).toEqual([]);
    vi.stubGlobal("navigator", {
      mediaDevices: { enumerateDevices: vi.fn().mockRejectedValue(new Error("x")) },
    });
    expect(await listMicInputs()).toEqual([]);
  });
});
