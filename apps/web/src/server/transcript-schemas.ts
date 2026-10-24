import { z } from "zod";

const MAX_QUERY_CHARS = 200;
const DEFAULT_HIT_LIMIT = 200;

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalInt = (min: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).optional());

/** `GET /api/meetings/:id/segments`. `limit` is clamped by the repository (1..500, default 200). */
export const segmentsQuerySchema = z.object({
  from: optionalInt(0),
  limit: z.preprocess(blankToUndefined, z.coerce.number().int().optional()),
  dir: z.preprocess(blankToUndefined, z.enum(["forward", "backward"]).default("forward")),
});
export type SegmentsQuery = z.infer<typeof segmentsQuerySchema>;

/** `GET /api/meetings/:id/segments/locate`: exactly one of `atMs` / `seq`. */
export const locateQuerySchema = z
  .object({
    atMs: optionalInt(0),
    seq: optionalInt(0),
    limit: z.preprocess(blankToUndefined, z.coerce.number().int().optional()),
  })
  .refine((query) => (query.atMs === undefined) !== (query.seq === undefined), {
    message: "cần đúng một trong atMs hoặc seq",
    path: ["atMs"],
  });
export type LocateQuery = z.infer<typeof locateQuerySchema>;

/** `GET /api/meetings/:id/search`. A blank `q` answers with no hits. */
export const transcriptSearchQuerySchema = z.object({
  q: z.preprocess(blankToUndefined, z.string().trim().max(MAX_QUERY_CHARS).default("")),
  limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).default(DEFAULT_HIT_LIMIT)),
});
export type TranscriptSearchQuery = z.infer<typeof transcriptSearchQuerySchema>;
