"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_DENSITY, DENSITY_STORAGE_KEY, isDensity, type Density } from "./density";

const listeners = new Set<() => void>();
/** Choice made in this tab; keeps the toggle working when storage is blocked. */
let chosen: Density | null = null;

function readStored(): Density {
  if (chosen !== null) return chosen;
  try {
    const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
    return isDensity(stored) ? stored : DEFAULT_DENSITY;
  } catch {
    return DEFAULT_DENSITY;
  }
}

function subscribe(listener: () => void): () => void {
  const onStorage = () => {
    chosen = null; // another tab changed it: the stored value wins
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Transcript density, remembered per browser. The server (and the hydration pass) always sees the
 * default, so there is no hydration mismatch; a stored choice applies right after hydration.
 */
export function useDensity(): [Density, (next: Density) => void] {
  const density = useSyncExternalStore(subscribe, readStored, () => DEFAULT_DENSITY);
  const setDensity = useCallback((next: Density) => {
    chosen = next;
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {
      // storage blocked: the choice then only lasts until reload
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [density, setDensity];
}
