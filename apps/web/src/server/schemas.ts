import {
  minutesContentSchema,
  minutesLangSchema,
  sourceLangSchema,
  targetLangSchema,
} from "@recap/core";
import { z } from "zod";
import {
  LANG_VALUES,
  MINUTES_VALUES,
  RANGE_VALUES,
  SORT_VALUES,
  STATUS_VALUES,
} from "@/lib/list-query";
import { isDayKey } from "@/lib/vn-time";

const MAX_TITLE = 200;
const MAX_AGENDA = 5_000;

const titleSchema = z.string().trim().min(1, "Tiêu đề không được để trống").max(MAX_TITLE);

export const createMeetingSchema = z.object({
  title: titleSchema,
  sourceLang: sourceLangSchema,
  targetLang: targetLangSchema,
  agenda: z.string().trim().max(MAX_AGENDA).optional(),
});

export const patchMeetingSchema = z.object({ title: titleSchema });

export const generateMinutesSchema = z.object({ lang: minutesLangSchema });
export const saveMinutesSchema = z.object({
  lang: minutesLangSchema,
  content: minutesContentSchema,
});
export const minutesQuerySchema = z.object({ lang: minutesLangSchema });

const MAX_QUERY = 200;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(blankToUndefined, z.enum(values).optional());

const dayKey = z.preprocess(
  blankToUndefined,
  z.string().refine(isDayKey, "phải có dạng YYYY-MM-DD").optional(),
);

/** `GET /api/meetings` query string. Blank values count as absent. */
export const listMeetingsQuerySchema = z
  .object({
    q: z.preprocess(blankToUndefined, z.string().trim().max(MAX_QUERY).optional()),
    status: optionalEnum(STATUS_VALUES),
    minutes: optionalEnum(MINUTES_VALUES),
    lang: optionalEnum(LANG_VALUES),
    range: optionalEnum(RANGE_VALUES),
    from: dayKey,
    to: dayKey,
    sort: optionalEnum(SORT_VALUES),
    limit: z.preprocess(
      blankToUndefined,
      z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    ),
    offset: z.preprocess(blankToUndefined, z.coerce.number().int().min(0).default(0)),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "from: không được sau to",
    path: ["from"],
  });
export type ListMeetingsQuery = z.infer<typeof listMeetingsQuerySchema>;
