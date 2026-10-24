/** Opens a microphone stream for a given device, falling back to the system default. */

const BASE_AUDIO = { echoCancellation: true, noiseSuppression: true, channelCount: 1 } as const;

/**
 * Exact device first; with `fallbackToDefault` (start of a session) any failure with it
 * (gone, OverconstrainedError) retries on the default. A hot-swap passes false: the user asked for
 * that specific mic, so silently switching to another one would be wrong.
 */
export async function openMicStream(
  deviceId?: string | null,
  fallbackToDefault = true,
): Promise<MediaStream | null> {
  const devices = navigator.mediaDevices;
  if (deviceId) {
    try {
      return await devices.getUserMedia({
        audio: { ...BASE_AUDIO, deviceId: { exact: deviceId } },
      });
    } catch {
      // Fall through to the default device.
    }
    if (!fallbackToDefault) return null;
  }
  try {
    return await devices.getUserMedia({ audio: BASE_AUDIO });
  } catch {
    return null;
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}
