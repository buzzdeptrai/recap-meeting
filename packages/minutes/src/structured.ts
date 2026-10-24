import { MinutesError } from "./errors";
import { LLM_SCHEMA_NAME, llmJsonSchema, llmMinutesSchema, type LlmMinutes } from "./llm-schema";
import { RETRY_NOTICE } from "./prompts";
import type { MinutesLlm } from "./types";

const MAX_ATTEMPTS = 2;

function parseReply(raw: string): { ok: true; data: LlmMinutes } | { ok: false; reason: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "the reply was not valid JSON" };
  }
  const result = llmMinutesSchema.safeParse(json);
  if (result.success) return { ok: true, data: result.data };
  const where = result.error.issues[0]?.path.join(".") || "root";
  return { ok: false, reason: `the JSON did not match the schema at "${where}"` };
}

/** One structured call; retries once (with a correction note) when the reply is not valid. */
export async function callStructured(
  llm: MinutesLlm,
  prompt: { system: string; user: string },
): Promise<LlmMinutes> {
  const jsonSchema = llmJsonSchema();
  let user = prompt.user;
  let lastReason = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = await callLlm(llm, { ...prompt, user, jsonSchema });
    const parsed = parseReply(raw);
    if (parsed.ok) return parsed.data;
    lastReason = parsed.reason;
    user = `${prompt.user}\n\n${RETRY_NOTICE(parsed.reason)}`;
  }
  throw new MinutesError(`Model returned invalid output twice: ${lastReason}`, "INVALID_OUTPUT");
}

async function callLlm(
  llm: MinutesLlm,
  req: { system: string; user: string; jsonSchema: Record<string, unknown> },
): Promise<string> {
  try {
    return await llm.generate({ ...req, schemaName: LLM_SCHEMA_NAME });
  } catch (err) {
    if (err instanceof MinutesError) throw err;
    const reason = err instanceof Error ? err.name : "unknown error";
    throw new MinutesError(`Minutes model call failed (${reason})`, "LLM_FAILED", { cause: err });
  }
}
