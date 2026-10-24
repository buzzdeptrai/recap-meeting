/** Pure helpers for the list of microphones: normalise, pick the saved one, enumerate. */

export interface MicOption {
  deviceId: string;
  /** Always non-empty: falls back to "Micro N" while the browser hides labels (before permission). */
  label: string;
}

const FALLBACK_LABEL = "Micro";
/** Chrome adds these pseudo-devices that duplicate a real input. */
const PSEUDO_IDS = new Set(["default", "communications"]);

/** Audio inputs only, without the "default"/"communications" aliases, with readable labels. */
export function toMicOptions(devices: ReadonlyArray<MediaDeviceInfo>): MicOption[] {
  const inputs = devices.filter(
    (device) => device.kind === "audioinput" && !PSEUDO_IDS.has(device.deviceId),
  );
  return inputs.map((device, index) => ({
    deviceId: device.deviceId,
    label: device.label.trim() || `${FALLBACK_LABEL} ${index + 1}`,
  }));
}

/** The saved device when it still exists, otherwise null (= use the system default). */
export function resolveMicChoice(
  savedId: string | null,
  options: ReadonlyArray<MicOption>,
): string | null {
  if (!savedId) return null;
  return options.some((option) => option.deviceId === savedId) ? savedId : null;
}

/** Inputs other than the one in use (for the "pick another mic" lists). */
export function otherMics(options: ReadonlyArray<MicOption>, activeId: string | null): MicOption[] {
  return options.filter((option) => option.deviceId !== activeId);
}

/** Enumerates inputs; an unsupported browser or a failure yields an empty list. */
export async function listMicInputs(): Promise<MicOption[]> {
  const devices = (globalThis.navigator?.mediaDevices as MediaDevices | undefined) ?? null;
  if (typeof devices?.enumerateDevices !== "function") return [];
  try {
    return toMicOptions(await devices.enumerateDevices());
  } catch {
    return [];
  }
}
