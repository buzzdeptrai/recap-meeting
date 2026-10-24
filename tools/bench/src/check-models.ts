import { configFromEnv, createTranslator } from "@recap/translate";

const SAMPLE_TEXT = "We can hold the price at 345 if they sign this quarter.";
const LIST_TIMEOUT_MS = 15_000;
const TRANSLATE_DEADLINE_MS = 15_000;
const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000";
const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";

export interface ModelCheck {
  provider: "gemini" | "openai";
  configured: string;
  listed: boolean | null;
  listError: string | null;
  modelIds: string[];
  translation: { ok: boolean; text?: string; latencyMs?: number; error?: string } | null;
}

type Env = Record<string, string | undefined>;

/** Removes every secret value from text so errors are safe to print and store. */
export function redact(text: string, secrets: readonly (string | undefined)[]): string {
  return secrets.reduce<string>(
    (out, secret) => (secret ? out.split(secret).join("[key]") : out),
    text,
  );
}

async function listIds(
  url: string,
  headers: Record<string, string>,
  pick: (body: unknown) => string[],
): Promise<string[]> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(LIST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return pick(await response.json()).sort();
}

const geminiIds = (body: unknown): string[] =>
  ((body as { models?: { name: string }[] }).models ?? []).map((m) =>
    m.name.replace(/^models\//, ""),
  );
const openaiIds = (body: unknown): string[] =>
  ((body as { data?: { id: string }[] }).data ?? []).map((m) => m.id);

async function tryTranslate(
  env: Env,
  provider: "gemini" | "openai",
): Promise<ModelCheck["translation"]> {
  try {
    const config = {
      ...configFromEnv({ ...env, TRANSLATE_PROVIDER_ORDER: provider }),
      deadlineMs: TRANSLATE_DEADLINE_MS,
    };
    const translator = createTranslator(config);
    const result = await translator.translate({
      meetingId: "check-models",
      seq: 0,
      text: SAMPLE_TEXT,
      sourceLang: "en",
      targetLang: "vi",
    });
    return { ok: true, text: result.text, latencyMs: Math.round(result.latencyMs) };
  } catch (error) {
    const secrets = [env.GEMINI_API_KEY, env.OPENAI_API_KEY];
    return { ok: false, error: redact(describeError(error), secrets) };
  }
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const attempts = (error as { attempts?: { code: string; message: string }[] }).attempts;
  return attempts?.length
    ? attempts.map((a) => `${a.code}: ${a.message}`).join("; ")
    : error.message;
}

async function checkProvider(env: Env, provider: "gemini" | "openai"): Promise<ModelCheck> {
  const isGemini = provider === "gemini";
  const key = (isGemini ? env.GEMINI_API_KEY : env.OPENAI_API_KEY) ?? "";
  const configured = (isGemini ? env.GEMINI_MODEL : env.OPENAI_TRANSLATE_MODEL) ?? "";
  const result: ModelCheck = {
    provider,
    configured,
    listed: null,
    listError: null,
    modelIds: [],
    translation: null,
  };
  try {
    result.modelIds = await listIds(
      isGemini ? GEMINI_MODELS_URL : OPENAI_MODELS_URL,
      isGemini ? { "x-goog-api-key": key } : { authorization: `Bearer ${key}` },
      isGemini ? geminiIds : openaiIds,
    );
    result.listed = result.modelIds.includes(configured);
  } catch (error) {
    result.listError = redact(describeError(error), [key]);
  }
  result.translation = await tryTranslate(env, provider);
  return result;
}

export async function checkModels(env: Env): Promise<ModelCheck[]> {
  const order = (env.TRANSLATE_PROVIDER_ORDER ?? "gemini,openai").split(",").map((p) => p.trim());
  const providers = (["gemini", "openai"] as const).filter((p) => order.includes(p));
  return Promise.all(providers.map((provider) => checkProvider(env, provider)));
}

export function renderModelChecks(checks: readonly ModelCheck[]): string {
  return checks
    .map((check) => {
      const listing = check.listError
        ? `model list failed: ${check.listError}`
        : `configured model "${check.configured}" listed: ${check.listed ? "yes" : "NO"} (${check.modelIds.length} models)`;
      const t = check.translation;
      const translation = !t
        ? "translation: skipped"
        : t.ok
          ? `translation: ${t.latencyMs} ms -> ${t.text}`
          : `translation FAILED: ${t.error}`;
      return `[${check.provider}] ${listing}\n  ${translation}`;
    })
    .join("\n");
}
