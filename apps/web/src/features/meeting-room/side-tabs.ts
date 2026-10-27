import type { PillTab } from "@recap/admin-ui";
import type { Mark } from "@recap/core";
import { conclusionMarks, topicMarks } from "./topics";

export const SIDE_TAB_IDS = ["topics", "conclusions", "session", "notes"] as const;
export type SideTabId = (typeof SIDE_TAB_IDS)[number];

export const SIDE_TABS_ID_BASE = "room-side";

/** Tabs of the right panel: counts on Chủ đề / Kết luận / Ghi chú. */
export function buildSideTabs(marks: Mark[], noteCount = 0): PillTab[] {
  return [
    { id: "topics", label: "Chủ đề", count: topicMarks(marks).length },
    {
      id: "conclusions",
      label: "Kết luận",
      count: conclusionMarks(marks).length,
      countTone: "decision",
    },
    { id: "session", label: "Phiên" },
    { id: "notes", label: "Ghi chú", count: noteCount },
  ];
}
