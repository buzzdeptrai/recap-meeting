import type { TranslatorConfig } from "../config";
import type { TranslationProvider } from "../types";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";

/** Builds the real providers named in `config.providerOrder`. Throws if a key is missing. */
export function createProviders(config: TranslatorConfig): Record<string, TranslationProvider> {
  const providers: Record<string, TranslationProvider> = {};
  for (const name of config.providerOrder) {
    if (name === "gemini") {
      providers.gemini = new GeminiProvider({
        apiKey: requireKey(name, config.gemini.apiKey),
        model: config.gemini.model,
      });
    } else {
      providers.openai = new OpenAIProvider({
        apiKey: requireKey(name, config.openai.apiKey),
        model: config.openai.model,
      });
    }
  }
  return providers;
}

function requireKey(name: string, key: string | undefined): string {
  if (!key) throw new Error(`Missing API key for translation provider "${name}"`);
  return key;
}
