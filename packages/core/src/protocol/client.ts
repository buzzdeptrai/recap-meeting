import { z } from "zod";
import {
  idSchema,
  markKindSchema,
  markLabelSchema,
  offsetMsSchema,
  sourceLangSchema,
  targetLangSchema,
} from "./shared";

export const startMessageSchema = z.object({
  type: z.literal("start"),
  meetingId: idSchema,
  sourceLang: sourceLangSchema,
  targetLang: targetLangSchema,
  resume: z.boolean().optional(),
});

export const markRequestSchema = z.object({
  type: z.literal("mark"),
  kind: markKindSchema,
  atMs: offsetMsSchema,
  label: markLabelSchema.optional(),
});

export const unmarkRequestSchema = z.object({ type: z.literal("unmark"), id: idSchema });

/** Renames a mark; an empty label clears it. */
export const markLabelRequestSchema = z.object({
  type: z.literal("mark_label"),
  id: idSchema,
  label: markLabelSchema,
});

/** Asks the server to restart the STT provider after it gave up reconnecting. */
export const sttRetryRequestSchema = z.object({ type: z.literal("stt_retry") });

export const stopMessageSchema = z.object({ type: z.literal("stop") });

export const pingMessageSchema = z.object({ type: z.literal("ping"), t: z.number() });

export const clientMessageSchema = z.discriminatedUnion("type", [
  startMessageSchema,
  markRequestSchema,
  unmarkRequestSchema,
  markLabelRequestSchema,
  sttRetryRequestSchema,
  stopMessageSchema,
  pingMessageSchema,
]);

export type StartMessage = z.infer<typeof startMessageSchema>;
export type MarkRequest = z.infer<typeof markRequestSchema>;
export type UnmarkRequest = z.infer<typeof unmarkRequestSchema>;
export type MarkLabelRequest = z.infer<typeof markLabelRequestSchema>;
export type SttRetryRequest = z.infer<typeof sttRetryRequestSchema>;
export type StopMessage = z.infer<typeof stopMessageSchema>;
export type PingMessage = z.infer<typeof pingMessageSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
