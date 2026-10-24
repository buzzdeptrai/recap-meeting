"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { nearestIndex, stepIndex } from "../lib/scale";

const MIN_WIDTH = 260;

/** Measure a container with ResizeObserver. `initial` is used for SSR and the first paint. */
export function useChartWidth(initial = 720) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.max(MIN_WIDTH, Math.round(el.clientWidth));
      setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A DOM-safe unique id prefix (useId output contains colons). */
export function useSvgId(): string {
  return useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

export interface CursorOptions {
  count: number;
  /** Plot box in chart pixels. */
  plotWidth: number;
  mode?: "point" | "band";
  /** Index shown when the overlay receives keyboard focus. Default: last. */
  initial?: "first" | "last";
}

/** Shared hover + keyboard cursor for the charts: pointer position -> index, arrows/Home/End, Escape. */
export function useChartCursor({
  count,
  plotWidth,
  mode = "point",
  initial = "last",
}: CursorOptions) {
  const [index, setIndex] = useState(-1);
  const clamp = useCallback((i: number) => Math.max(0, Math.min(count - 1, i)), [count]);

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = rect.width > 0 ? plotWidth / rect.width : 1; // CSS-scaled svgs (static previews)
    setIndex(clamp(nearestIndex((e.clientX - rect.left) * scale, plotWidth, count, mode)));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") return setIndex(-1);
    const next = stepIndex(e.key, index, count);
    if (next === null) return;
    e.preventDefault();
    setIndex(clamp(next));
  };
  return {
    index: index >= count ? count - 1 : index,
    handlers: {
      onPointerMove,
      onPointerLeave: () => setIndex(-1),
      onFocus: () => setIndex((i) => (i >= 0 ? i : clamp(initial === "first" ? 0 : count - 1))),
      onBlur: () => setIndex(-1),
      onKeyDown,
    },
  };
}
