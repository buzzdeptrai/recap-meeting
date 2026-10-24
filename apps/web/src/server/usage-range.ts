import { z } from "zod";
import { DEFAULT_TZ_OFFSET_MINUTES } from "@recap/db";

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const MAX_RANGE_DAYS = 366;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TZ_HHMM = /^([+-])(\d{2}):?(\d{2})$/;
const MAX_TZ_MINUTES = 14 * 60;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

export interface UsageRangeQuery {
  /** Inclusive, ISO UTC. */
  from: string;
  /** Exclusive, ISO UTC. */
  to: string;
  tzOffsetMinutes: number;
}

const blank = (v: unknown) => (v === "" ? undefined : v);

/** `tz`: minutes east of UTC ("420") or "+07:00" / "-0330". Default +07:00 (Asia/Ho_Chi_Minh). */
export function parseTz(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_TZ_OFFSET_MINUTES;
  const hhmm = TZ_HHMM.exec(raw);
  const minutes = hhmm
    ? (hhmm[1] === "-" ? -1 : 1) * (Number(hhmm[2]) * 60 + Number(hhmm[3]))
    : /^-?\d+$/.test(raw)
      ? Number(raw)
      : Number.NaN;
  return Number.isFinite(minutes) && Math.abs(minutes) <= MAX_TZ_MINUTES ? minutes : null;
}

/** Local midnight of a YYYY-MM-DD date, as epoch ms. */
function localMidnight(date: string, tz: number): number {
  return Date.parse(`${date}T00:00:00.000Z`) - tz * MS_PER_MINUTE;
}

/** Start (epoch ms) of the local day containing `ms`. */
export function startOfLocalDay(ms: number, tz: number): number {
  return localMidnight(new Date(ms + tz * MS_PER_MINUTE).toISOString().slice(0, 10), tz);
}

/** Start of the local calendar month containing `ms`. */
export function startOfLocalMonth(ms: number, tz: number): number {
  const month = new Date(ms + tz * MS_PER_MINUTE).toISOString().slice(0, 7);
  return localMidnight(`${month}-01`, tz);
}

/** Local days (YYYY-MM-DD) covered by [from, to). */
export function dayKeys(range: UsageRangeQuery): string[] {
  const keys: string[] = [];
  const end = Date.parse(range.to);
  for (
    let t = startOfLocalDay(Date.parse(range.from), range.tzOffsetMinutes);
    t < end;
    t += MS_PER_DAY
  ) {
    keys.push(new Date(t + range.tzOffsetMinutes * MS_PER_MINUTE).toISOString().slice(0, 10));
  }
  return keys;
}

const instant = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "phải là ngày/giờ ISO");

const rangeShape = {
  from: z.preprocess(blank, instant.optional()),
  to: z.preprocess(blank, instant.optional()),
  tz: z.preprocess(blank, z.string().optional()),
};

/**
 * Normalises `from`/`to`/`tz`. A date-only `from` is local midnight; a date-only `to` is
 * inclusive (end of that local day). Full ISO instants are used as-is (`to` exclusive).
 * Defaults: from = start of the current local month, to = now.
 */
export function normalizeRange(
  raw: { from?: string; to?: string; tz?: string },
  ctx: z.RefinementCtx,
  nowMs: number = Date.now(),
): UsageRangeQuery {
  const tz = parseTz(raw.tz);
  if (tz === null) {
    ctx.addIssue({ code: "custom", path: ["tz"], message: "tz không hợp lệ (vd +07:00 hoặc 420)" });
    return { from: "", to: "", tzOffsetMinutes: DEFAULT_TZ_OFFSET_MINUTES };
  }
  const fromMs = raw.from
    ? DATE_ONLY.test(raw.from)
      ? localMidnight(raw.from, tz)
      : Date.parse(raw.from)
    : startOfLocalMonth(nowMs, tz);
  const toMs = raw.to
    ? DATE_ONLY.test(raw.to)
      ? localMidnight(raw.to, tz) + MS_PER_DAY
      : Date.parse(raw.to)
    : nowMs;
  if (toMs <= fromMs) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "to phải sau from" });
  } else if (toMs - fromMs > MAX_RANGE_DAYS * MS_PER_DAY) {
    ctx.addIssue({ code: "custom", path: ["to"], message: `khoảng tối đa ${MAX_RANGE_DAYS} ngày` });
  }
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    tzOffsetMinutes: tz,
  };
}

const withRange = <T extends z.ZodRawShape>(extra: T) =>
  z.object({ ...rangeShape, ...extra }).transform((q, ctx) => {
    const { from, to, tz, ...rest } = q as { from?: string; to?: string; tz?: string };
    return { ...rest, ...normalizeRange({ from, to, tz }, ctx) } as z.output<z.ZodObject<T>> &
      UsageRangeQuery;
  });

export const summaryQuerySchema = withRange({});
export const reliabilityQuerySchema = withRange({});

export const seriesQuerySchema = withRange({
  metric: z.preprocess(blank, z.enum(["cost", "seconds", "tokens", "requests"]).default("cost")),
  groupBy: z.preprocess(blank, z.enum(["vendor", "model", "service"]).default("vendor")),
});

export const breakdownQuerySchema = withRange({
  groupBy: z.preprocess(blank, z.enum(["vendor", "model", "service", "meeting"]).default("vendor")),
});

export const meetingsQuerySchema = withRange({
  limit: z.preprocess(blank, z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)),
});

export const exportQuerySchema = withRange({
  groupBy: z.preprocess(
    blank,
    z.enum(["day", "vendor", "model", "service", "meeting"]).default("day"),
  ),
});

export type SeriesQuery = z.infer<typeof seriesQuerySchema>;
export type BreakdownQuery = z.infer<typeof breakdownQuerySchema>;
export type MeetingsQuery = z.infer<typeof meetingsQuerySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
