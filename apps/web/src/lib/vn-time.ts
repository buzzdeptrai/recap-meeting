/**
 * Calendar maths in Asia/Ho_Chi_Minh (UTC+7, no DST) without depending on the server's or the
 * browser's time zone: server (range filters) and client (day headings) must agree on "today".
 */
const VN_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Shifts an instant so that its UTC fields read as Vietnam local time. */
const toLocal = (ms: number) => new Date(ms + VN_OFFSET_MS);

/** `2026-10-22` for the Vietnam calendar day containing the instant. */
export function vnDayKey(iso: string | number | Date): string {
  const ms = iso instanceof Date ? iso.getTime() : typeof iso === "number" ? iso : Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = toLocal(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Start (00:00 Vietnam time) of a `YYYY-MM-DD` day as epoch ms; NaN when the key is invalid. */
export function vnDayStart(key: string): number {
  const m = DAY_KEY.exec(key);
  if (!m) return Number.NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d) - VN_OFFSET_MS;
  // Reject 2026-02-31 style keys that Date.UTC silently rolls over.
  return vnDayKey(ms) === key ? ms : Number.NaN;
}

export const isDayKey = (value: string) => !Number.isNaN(vnDayStart(value));

/** Start of the Vietnam week (Monday 00:00) containing `now`. */
export function vnWeekStart(now: number): number {
  const dayStart = vnDayStart(vnDayKey(now));
  const weekday = toLocal(now).getUTCDay(); // 0 = Sunday
  return dayStart - ((weekday + 6) % 7) * DAY_MS;
}

export function vnMonthStart(now: number): number {
  const d = toLocal(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - VN_OFFSET_MS;
}

/** `22/10/2026` for a day key. */
export function formatDayKey(key: string): string {
  const m = DAY_KEY.exec(key);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : key;
}

/** Heading for a day group: "Hôm nay", "Hôm qua" or "Thứ Hai, 20/10/2026". */
export function dayHeading(key: string, now: number): string {
  const today = vnDayStart(vnDayKey(now));
  const start = vnDayStart(key);
  if (start === today) return "Hôm nay";
  if (start === today - DAY_MS) return "Hôm qua";
  const weekday = WEEKDAYS[toLocal(start + VN_OFFSET_MS / 2).getUTCDay()] ?? "";
  return `${weekday}, ${formatDayKey(key)}`;
}

export interface DayGroup<T> {
  key: string;
  heading: string;
  items: T[];
}

/** Consecutive items with the same Vietnam calendar day form one group (input order is kept). */
export function groupByDay<T>(
  items: readonly T[],
  getIso: (item: T) => string,
  now: number,
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const key = vnDayKey(getIso(item));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, heading: dayHeading(key, now), items: [item] });
  }
  return groups;
}

/** `HH:mm` in Vietnam time. */
export function formatVnTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const d = toLocal(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export { DAY_MS, VN_OFFSET_MS };
