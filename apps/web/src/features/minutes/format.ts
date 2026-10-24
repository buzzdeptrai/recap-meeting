const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;

const pad = (value: number) => String(value).padStart(2, "0");

/** mm:ss for chips; grows to h:mm:ss only past one hour. */
export function formatChip(atMs: number): string {
  const total = Math.max(0, Math.floor(atMs / MS_PER_SECOND));
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = pad(total % SECONDS_PER_MINUTE);
  return hours > 0 ? `${hours}:${pad(minutes)}:${seconds}` : `${pad(minutes)}:${seconds}`;
}

/** Link back to the transcript at a moment; the room scrolls to the nearest segment. */
export function transcriptHref(meetingId: string, atMs: number): string {
  return `/meetings/${encodeURIComponent(meetingId)}?t=${Math.max(0, Math.round(atMs))}`;
}

const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 14:05 — when the minutes were last saved. */
export function formatSavedTime(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "—" : timeFormat.format(parsed);
}
