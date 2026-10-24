import { z } from "zod";
import { offsetMsSchema } from "./protocol/shared";

export const MINUTES_LANGS = ["vi", "en"] as const;
export const minutesLangSchema = z.enum(MINUTES_LANGS);
export type MinutesLang = z.infer<typeof minutesLangSchema>;

/** UI labels: decided = Đã thống nhất, open = Còn bỏ ngỏ, rejected = Đã loại. */
export const topicStatusSchema = z.enum(["decided", "open", "rejected"]);
export type TopicStatus = z.infer<typeof topicStatusSchema>;

const MAX_SHORT_TEXT = 500;
const MAX_LONG_TEXT = 4_000;
const MAX_TOPICS = 60;
const MAX_ITEMS = 100;

const shortText = z.string().trim().min(1).max(MAX_SHORT_TEXT);
const longText = z.string().trim().min(1).max(MAX_LONG_TEXT);
const atMsSchema = offsetMsSchema.nullable();

export const keyPointSchema = z.object({ text: longText, atMs: atMsSchema });

export const conclusionSchema = z.object({
  text: longText,
  atMs: atMsSchema,
  /** True when backed by a user "conclusion" mark. */
  marked: z.boolean(),
});

export const topicSchema = z.object({
  id: z.string().min(1),
  title: shortText,
  keyPoints: z.array(keyPointSchema).max(MAX_ITEMS),
  status: topicStatusSchema,
  conclusion: conclusionSchema.nullable(),
});

export const actionItemSchema = z.object({
  id: z.string().min(1),
  task: longText,
  owner: shortText.nullable(),
  due: shortText.nullable(),
  atMs: atMsSchema,
});

export const openIssueSchema = z.object({ id: z.string().min(1), text: longText });

export const minutesContentSchema = z.object({
  summary: z.string().trim().min(1).max(MAX_LONG_TEXT),
  topics: z.array(topicSchema).max(MAX_TOPICS),
  actionItems: z.array(actionItemSchema).max(MAX_ITEMS),
  openIssues: z.array(openIssueSchema).max(MAX_ITEMS),
});

export type KeyPoint = z.infer<typeof keyPointSchema>;
export type Conclusion = z.infer<typeof conclusionSchema>;
export type MinutesTopic = z.infer<typeof topicSchema>;
export type ActionItem = z.infer<typeof actionItemSchema>;
export type OpenIssue = z.infer<typeof openIssueSchema>;
export type MinutesContent = z.infer<typeof minutesContentSchema>;

export const minutesSourceSchema = z.enum(["ai", "edited"]);
export type MinutesSource = z.infer<typeof minutesSourceSchema>;
