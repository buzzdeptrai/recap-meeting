"use client";

import { useCallback, useEffect, useRef } from "react";

/** Stable function identity that always calls the newest `fn` (no stale closures in long-lived callbacks). */
export function useStableCallback<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  return useCallback((...args: Args) => ref.current(...args), []);
}
