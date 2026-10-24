import type { MinutesContent } from "@recap/core";
import { minutesContentSchema } from "@recap/core";
import { z } from "zod";
import type { Parsed } from "./structured";

/**
 * The prose of minutes and nothing else: no ids, timestamps, statuses or flags. The model
 * translates this; everything else is copied from the source by position, so it cannot be altered.
 * Free of length/range constraints so OpenAI strict mode accepts it.
 */
export const minutesTextSchema = z.object({
  summary: z.string(),
  topics: z.array(
    z.object({
      title: z.string(),
      keyPoints: z.array(z.string()),
      conclusion: z.string().nullable(),
    }),
  ),
  actionItems: z.array(z.object({ task: z.string(), due: z.string().nullable() })),
  openIssues: z.array(z.string()),
});

export type MinutesText = z.infer<typeof minutesTextSchema>;

export const TRANSLATE_SCHEMA_NAME = "meeting_minutes_translation";

export function translateJsonSchema(): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(minutesTextSchema) as Record<
    string,
    unknown
  >;
  return schema;
}

/** The translatable text of minutes. Owners are names and stay as they are. */
export function extractText(content: MinutesContent): MinutesText {
  return {
    summary: content.summary,
    topics: content.topics.map((t) => ({
      title: t.title,
      keyPoints: t.keyPoints.map((k) => k.text),
      conclusion: t.conclusion?.text ?? null,
    })),
    actionItems: content.actionItems.map((a) => ({ task: a.task, due: a.due })),
    openIssues: content.openIssues.map((i) => i.text),
  };
}

const shapeMismatch = (where: string): Parsed<never> => ({
  ok: false,
  reason: `the structure changed at "${where}" (counts and nulls must match the input exactly)`,
});

/**
 * Puts translated text back into the source structure by position. Ids, `atMs`, status,
 * `marked`, owners and the number of items always come from the source. Fails (so the caller
 * retries) when the model changed a count or a null, or the result breaks the minutes schema.
 */
export function mergeText(source: MinutesContent, text: MinutesText): Parsed<MinutesContent> {
  if (text.topics.length !== source.topics.length) return shapeMismatch("topics");
  if (text.actionItems.length !== source.actionItems.length) return shapeMismatch("actionItems");
  if (text.openIssues.length !== source.openIssues.length) return shapeMismatch("openIssues");
  for (const [i, topic] of source.topics.entries()) {
    const t = text.topics[i];
    if (!t || t.keyPoints.length !== topic.keyPoints.length) return shapeMismatch(`topics.${i}`);
    if ((t.conclusion === null) !== (topic.conclusion === null)) {
      return shapeMismatch(`topics.${i}.conclusion`);
    }
  }
  for (const [i, item] of source.actionItems.entries()) {
    if ((text.actionItems[i]?.due === null) !== (item.due === null)) {
      return shapeMismatch(`actionItems.${i}.due`);
    }
  }
  const merged = {
    summary: text.summary,
    topics: source.topics.map((topic, i) => {
      const t = text.topics[i]!;
      return {
        ...topic,
        title: t.title,
        keyPoints: topic.keyPoints.map((k, j) => ({ ...k, text: t.keyPoints[j]! })),
        conclusion:
          topic.conclusion && t.conclusion !== null
            ? { ...topic.conclusion, text: t.conclusion }
            : null,
      };
    }),
    actionItems: source.actionItems.map((a, i) => ({
      ...a,
      task: text.actionItems[i]!.task,
      due: text.actionItems[i]!.due,
    })),
    openIssues: source.openIssues.map((o, i) => ({ ...o, text: text.openIssues[i]! })),
  };
  const result = minutesContentSchema.safeParse(merged);
  if (result.success) return { ok: true, data: result.data };
  const where = result.error.issues[0]?.path.join(".") || "root";
  return { ok: false, reason: `the translated minutes are not valid at "${where}"` };
}

/** `parse` for `callStructuredWith`: checks the reply shape, then merges into `source`. */
export function parseTranslation(source: MinutesContent) {
  return (json: unknown): Parsed<MinutesContent> => {
    const result = minutesTextSchema.safeParse(json);
    if (!result.success) {
      const where = result.error.issues[0]?.path.join(".") || "root";
      return { ok: false, reason: `the JSON did not match the schema at "${where}"` };
    }
    return mergeText(source, result.data);
  };
}
