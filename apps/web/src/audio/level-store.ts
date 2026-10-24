import { useSyncExternalStore } from "react";
import { smoothLevel, rmsToLevel } from "./levels";

export type LevelPair = readonly [mic: number, tab: number];
const SILENT: LevelPair = [0, 0];

/** Tiny external store so only the meters re-render at 10 Hz, not the whole room. */
export function createLevelStore() {
  let current: LevelPair = SILENT;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    get: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Feed raw RMS values (0..1) from one frame. */
    pushRms(mic: number, tab: number) {
      current = [
        smoothLevel(current[0], rmsToLevel(mic)),
        smoothLevel(current[1], rmsToLevel(tab)),
      ];
      emit();
    },
    reset() {
      current = SILENT;
      emit();
    },
  };
}

export type LevelStore = ReturnType<typeof createLevelStore>;

export function useLevels(store: LevelStore): LevelPair {
  return useSyncExternalStore(store.subscribe, store.get, () => SILENT);
}
