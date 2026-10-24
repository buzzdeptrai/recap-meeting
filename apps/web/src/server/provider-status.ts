/** Which vendors are configured, read from env presence only. Key values never leave this module. */
export type ProviderId = "deepgram" | "gemini" | "openai" | "assemblyai";

export const PROVIDER_IDS: readonly ProviderId[] = ["deepgram", "gemini", "openai", "assemblyai"];

interface ProviderSpec {
  id: ProviderId;
  label: string;
  purpose: string;
  required: boolean;
  keyEnv: string;
  modelEnvs: readonly string[];
}

export const PROVIDERS: readonly ProviderSpec[] = [
  {
    id: "deepgram",
    label: "Deepgram",
    purpose: "Chép lời trực tiếp",
    required: true,
    keyEnv: "DEEPGRAM_API_KEY",
    modelEnvs: ["DEEPGRAM_MODEL", "DEEPGRAM_LANGUAGE"],
  },
  {
    id: "gemini",
    label: "Gemini",
    purpose: "Dịch (ưu tiên)",
    required: true,
    keyEnv: "GEMINI_API_KEY",
    modelEnvs: ["GEMINI_MODEL"],
  },
  {
    id: "openai",
    label: "OpenAI",
    purpose: "Dịch dự phòng và tạo biên bản",
    required: true,
    keyEnv: "OPENAI_API_KEY",
    modelEnvs: ["OPENAI_TRANSLATE_MODEL", "OPENAI_MINUTES_MODEL"],
  },
  {
    id: "assemblyai",
    label: "AssemblyAI",
    purpose: "Chép lời phương án B (tùy chọn)",
    required: false,
    keyEnv: "ASSEMBLYAI_API_KEY",
    modelEnvs: [],
  },
];

export interface ProviderStatusDto {
  id: ProviderId;
  label: string;
  purpose: string;
  required: boolean;
  configured: boolean;
  /** Always a mask, never the key. */
  maskedKey: string;
  keyEnv: string;
  models: Array<{ env: string; set: boolean; value: string | null }>;
}

export const KEY_MASK = "••••";

type Env = Record<string, string | undefined>;

const filled = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== "";

export function getProviderStatuses(env: Env = process.env): ProviderStatusDto[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    purpose: p.purpose,
    required: p.required,
    configured: filled(env[p.keyEnv]),
    maskedKey: filled(env[p.keyEnv]) ? KEY_MASK : "—",
    keyEnv: p.keyEnv,
    models: p.modelEnvs.map((name) => ({
      env: name,
      set: filled(env[name]),
      value: filled(env[name]) ? env[name].trim() : null,
    })),
  }));
}

export function providerKey(id: ProviderId, env: Env = process.env): string | null {
  const spec = PROVIDERS.find((p) => p.id === id);
  const value = spec ? env[spec.keyEnv] : undefined;
  return filled(value) ? value.trim() : null;
}
