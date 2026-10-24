import type { MinutesLang } from "@recap/core";

const pad = (n: number) => String(n).padStart(2, "0");
const MS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = 3600;

/** Offset into the meeting as mm:ss (hh:mm:ss past an hour). */
export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  const h = Math.floor(total / SECONDS_PER_HOUR);
  const m = Math.floor((total % SECONDS_PER_HOUR) / 60);
  const s = total % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatDuration(ms: number | null, lang: MinutesLang): string {
  if (ms === null || ms < 0) return "—";
  const minutes = Math.max(1, Math.round(ms / (MS_PER_SECOND * 60)));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const [hour, min] = lang === "vi" ? ["giờ", "phút"] : ["h", "min"];
  if (h === 0) return `${m} ${min}`;
  return m === 0 ? `${h} ${hour}` : `${h} ${hour} ${m} ${min}`;
}

export function formatDateTime(iso: string | null, lang: MinutesLang): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const day = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return lang === "vi" ? `${time}, ${day}` : `${day} ${time}`;
}
