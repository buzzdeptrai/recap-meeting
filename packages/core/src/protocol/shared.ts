import { z } from "zod";
import { CHANNEL_ME, CHANNEL_OTHERS } from "../constants";

export const channelSchema = z.union([z.literal(CHANNEL_ME), z.literal(CHANNEL_OTHERS)]);
export type Channel = z.infer<typeof channelSchema>;

export const sourceLangSchema = z.enum(["auto", "vi", "en", "multi"]);
export type SourceLang = z.infer<typeof sourceLangSchema>;

export const targetLangSchema = z.enum(["vi", "en"]);
export type TargetLang = z.infer<typeof targetLangSchema>;

export const markKindSchema = z.enum(["conclusion", "topic"]);
export type MarkKind = z.infer<typeof markKindSchema>;

/** Max length of a mark label (topic name). */
export const MARK_LABEL_MAX = 120;
export const markLabelSchema = z.string().max(MARK_LABEL_MAX);

/** Milliseconds since meeting start. */
export const offsetMsSchema = z.number().int().nonnegative();
export const idSchema = z.string().min(1);
