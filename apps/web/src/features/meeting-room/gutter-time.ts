import { formatClock } from "@/lib/format";

/** Start time for the narrow gutter beside continuation rows: "4:15", "1:02:03" (no leading zeros). */
export function formatGutterTime(ms: number): string {
  const clock = formatClock(ms);
  if (clock.startsWith("00:")) return clock.slice(3).replace(/^0/, "");
  return clock.replace(/^0/, "");
}
