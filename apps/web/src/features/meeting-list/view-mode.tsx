"use client";

import { Rows, SquaresFour } from "@phosphor-icons/react";
import { SegmentedControl } from "@recap/admin-ui";
import { useSyncExternalStore } from "react";

export type ViewMode = "table" | "cards";

const STORAGE_KEY = "recap.meetings.view";

const OPTIONS = [
  { value: "table", label: "Bảng", icon: <Rows size={14} /> },
  { value: "cards", label: "Thẻ", icon: <SquaresFour size={14} /> },
] as const;

function readStored(): ViewMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "cards" ? "cards" : "table";
  } catch {
    return "table";
  }
}

const listeners = new Set<() => void>();
let memory: ViewMode | null = null;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Table/card choice, remembered per browser (storage may be blocked: then it lives in memory). */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const mode = useSyncExternalStore(
    subscribe,
    () => memory ?? readStored(),
    () => "table" as const,
  );
  const update = (next: ViewMode) => {
    memory = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode or blocked storage: keep the in-memory choice */
    }
    listeners.forEach((listener) => listener());
  };
  return [mode, update];
}

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <SegmentedControl<ViewMode>
      ariaLabel="Kiểu hiển thị"
      variant="tabs"
      size="sm"
      options={OPTIONS}
      value={mode}
      onValueChange={onChange}
    />
  );
}
