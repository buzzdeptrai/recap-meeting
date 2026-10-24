/** Remembers the chosen microphone in localStorage; every access is guarded (page works without it). */

export const MIC_STORAGE_KEY = "recap.micDeviceId";

const listeners = new Set<() => void>();

export function loadMicChoice(): string | null {
  try {
    return globalThis.localStorage?.getItem(MIC_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/** Saves the choice; null clears it (back to the system default). Subscribers are notified. */
export function saveMicChoice(deviceId: string | null): void {
  try {
    if (deviceId) globalThis.localStorage?.setItem(MIC_STORAGE_KEY, deviceId);
    else globalThis.localStorage?.removeItem(MIC_STORAGE_KEY);
  } catch {
    // Blocked storage: the choice just is not remembered.
  }
  listeners.forEach((listener) => listener());
}

/** For useSyncExternalStore: re-render when the choice is saved from anywhere in this page. */
export function subscribeMicChoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
