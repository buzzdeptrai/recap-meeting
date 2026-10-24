import { z } from "zod";

/**
 * What the model returns: the MinutesContent shape minus ids (the app assigns them) and with
 * timestamps as "mm:ss" strings (the format it reads in the transcript). Deliberately free of
 * length/range constraints so OpenAI strict mode accepts it; `@recap/core` validates afterwards.
 */
export const llmMinutesSchema = z.object({
  summary: z.string(),
  topics: z.array(
    z.object({
      title: z.string(),
      keyPoints: z.array(z.object({ text: z.string(), at: z.string().nullable() })),
      status: z.enum(["decided", "open", "rejected"]),
      conclusion: z
        .object({ text: z.string(), at: z.string().nullable(), marked: z.boolean() })
        .nullable(),
    }),
  ),
  actionItems: z.array(
    z.object({
      task: z.string(),
      owner: z.string().nullable(),
      due: z.string().nullable(),
      at: z.string().nullable(),
    }),
  ),
  openIssues: z.array(z.object({ text: z.string() })),
});

export type LlmMinutes = z.infer<typeof llmMinutesSchema>;

export const LLM_SCHEMA_NAME = "meeting_minutes";

/** JSON Schema sent to the model, derived from the zod schema. */
export function llmJsonSchema(): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(llmMinutesSchema) as Record<
    string,
    unknown
  >;
  return schema;
}
