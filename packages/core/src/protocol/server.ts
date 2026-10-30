import { z } from "zod";
import {
  channelSchema,
  idSchema,
  markKindSchema,
  markLabelSchema,
  offsetMsSchema,
  targetLangSchema,
} from "./shared";

export const sttStateSchema = z.enum(["connecting", "open", "reconnecting", "closed"]);
export type SttState = z.infer<typeof sttStateSchema>;

export const errorCodeSchema = z.enum([
  "STT_UNAVAILABLE",
  "BAD_MESSAGE",
  "MEETING_NOT_FOUND",
  "TRANSLATE_FAILED",
  "INTERNAL",
  /** `stt_retry` while no live recording exists. */
  "NOT_RECORDING",
  /** `stt_retry` while the provider is already connecting/open (no-op). */
  "STT_ALREADY_OPEN",
  /** `stt_retry` too soon after the last one, or too many in this session. */
  "RATE_LIMITED",
  /** The same user started this meeting from another connection; this one no longer records. */
  "SESSION_REPLACED",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const segmentSchema = z.object({
  id: idSchema,
  seq: z.number().int().nonnegative(),
  channel: channelSchema,
  lang: z.string().nullable(),
  startMs: offsetMsSchema,
  endMs: offsetMsSchema,
  text: z.string(),
});
export type Segment = z.infer<typeof segmentSchema>;

export const markSchema = z.object({
  id: idSchema,
  kind: markKindSchema,
  atMs: offsetMsSchema,
  /** Topic name (or optional note); `null` when unset. Missing in old messages = null. */
  label: markLabelSchema.nullable().default(null),
});
export type Mark = z.infer<typeof markSchema>;

export const readyMessageSchema = z.object({
  type: z.literal("ready"),
  meetingId: idSchema,
  startedAt: z.iso.datetime(),
  /** Audio already recorded for this meeting (ms); 0/absent for a fresh one. Timeline position now = baseMs. */
  baseMs: offsetMsSchema.optional(),
});

export const statusMessageSchema = z.object({
  type: z.literal("status"),
  stt: sttStateSchema,
  translate: z.object({ provider: z.string().nullable(), degraded: z.boolean() }),
});

export const interimMessageSchema = z.object({
  type: z.literal("interim"),
  channel: channelSchema,
  text: z.string(),
  startMs: offsetMsSchema,
  endMs: offsetMsSchema,
});

export const segmentMessageSchema = z.object({
  type: z.literal("segment"),
  segment: segmentSchema,
});

export const translationMessageSchema = z.object({
  type: z.literal("translation"),
  segmentId: idSchema,
  seq: z.number().int().nonnegative(),
  lang: targetLangSchema,
  text: z.string(),
  provider: z.string(),
  latencyMs: z.number().nonnegative(),
});

export const markMessageSchema = z.object({ type: z.literal("mark"), mark: markSchema });

/** Mark removed (also sent as echo to the client that asked). */
export const unmarkMessageSchema = z.object({ type: z.literal("unmark"), id: idSchema });

export const errorMessageSchema = z.object({
  type: z.literal("error"),
  code: errorCodeSchema,
  message: z.string(),
  segmentId: idSchema.optional(),
});

export const pongMessageSchema = z.object({ type: z.literal("pong"), t: z.number() });

export const stoppedMessageSchema = z.object({ type: z.literal("stopped"), meetingId: idSchema });

export const serverMessageSchema = z.discriminatedUnion("type", [
  readyMessageSchema,
  statusMessageSchema,
  interimMessageSchema,
  segmentMessageSchema,
  translationMessageSchema,
  markMessageSchema,
  unmarkMessageSchema,
  errorMessageSchema,
  pongMessageSchema,
  stoppedMessageSchema,
]);

export type ReadyMessage = z.infer<typeof readyMessageSchema>;
export type StatusMessage = z.infer<typeof statusMessageSchema>;
export type InterimMessage = z.infer<typeof interimMessageSchema>;
export type SegmentMessage = z.infer<typeof segmentMessageSchema>;
export type TranslationMessage = z.infer<typeof translationMessageSchema>;
export type MarkMessage = z.infer<typeof markMessageSchema>;
export type UnmarkMessage = z.infer<typeof unmarkMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;
export type PongMessage = z.infer<typeof pongMessageSchema>;
export type StoppedMessage = z.infer<typeof stoppedMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
