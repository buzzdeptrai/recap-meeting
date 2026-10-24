import { MinutesError } from "./errors";
import { LLM_SCHEMA_NAME, llmJsonSchema, llmMinutesSchema, type LlmMinutes } from "./llm-schema";
import { RETRY_NOTICE } from "./prompts";
import type { MinutesLlm } from "./types";

const MAX_ATTEMPTS = 2;

export type Parsed<T> = { ok: true; data: T } | { ok: false; reason: string };

/** What one structured call needs: the schema the model must follow and how to check its reply. */
export interface StructuredSpec<T> {
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  parse: (json: unknown) => Parsed<T>;
}

function parseJson(raw: string): Parsed<unknown> {
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch {
    return { ok: false, reason: "the reply was not valid JSON" };
  }
}

function parseMinutes(json: unknown): Parsed<LlmMinutes> {
  const result = llmMinutesSchema.safeParse(json);
  if (result.success) return { ok: true, data: result.data };
  const where = result.error.issues[0]?.path.join(".") || "root";
  return { ok: false, reason: `the JSON did not match the schema at "${where}"` };
}

/** One structured call; retries once (with a correction note) when the reply is not valid. */
export async function callStructuredWith<T>(
  llm: MinutesLlm,
  spec: StructuredSpec<T>,
  prompt: { system: string; user: string },
): Promise<T> {
  let user = prompt.user;
  let lastReason = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = await callLlm(llm, spec, { system: prompt.system, user });
    const json = parseJson(raw);
    const parsed = json.ok ? spec.parse(json.data) : json;
    if (parsed.ok) return parsed.data;
    lastReason = parsed.reason;
    user = `${prompt.user}\n\n${RETRY_NOTICE(parsed.reason)}`;
  }
  throw new MinutesError(`Model returned invalid output twice: ${lastReason}`, "INVALID_OUTPUT");
}

/** The minutes-generation call (map, reduce and single pass). */
export function callStructured(
  llm: MinutesLlm,
  prompt: { system: string; user: string },
): Promise<LlmMinutes> {
  return callStructuredWith(
    llm,
    { schemaName: LLM_SCHEMA_NAME, jsonSchema: llmJsonSchema(), parse: parseMinutes },
    prompt,
  );
}

async function callLlm(
  llm: MinutesLlm,
  spec: StructuredSpec<unknown>,
  req: { system: string; user: string },
): Promise<string> {
  try {
    return await llm.generate({ ...req, schemaName: spec.schemaName, jsonSchema: spec.jsonSchema });
  } catch (err) {
    if (err instanceof MinutesError) throw err;
    const reason = err instanceof Error ? err.name : "unknown error";
    throw new MinutesError(`Minutes model call failed (${reason})`, "LLM_FAILED", { cause: err });
  }
}
