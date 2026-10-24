import { GoogleGenAI } from "@google/genai";
import { ProviderError, classifyError } from "../errors";
import type {
  ProviderCallOptions,
  TranslationOutput,
  TranslationProvider,
  TranslationRequest,
} from "../types";
import { runWithDeadline } from "./deadline";

const TEMPERATURE = 0.2;

/** The slice of the @google/genai client this provider uses (injectable for tests). */
export interface GeminiClientLike {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config: { systemInstruction: string; temperature: number; abortSignal: AbortSignal };
    }): Promise<{
      text?: string;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        thoughtsTokenCount?: number;
      };
    }>;
  };
}

export interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  client?: GeminiClientLike;
}

export class GeminiProvider implements TranslationProvider {
  readonly name = "gemini";
  readonly model: string;
  private readonly client: GeminiClientLike;

  constructor(private readonly options: GeminiProviderOptions) {
    this.model = options.model;
    this.client =
      options.client ??
      (new GoogleGenAI({ apiKey: options.apiKey }) as unknown as GeminiClientLike);
  }

  async translate(
    req: TranslationRequest,
    { signal, deadlineMs }: ProviderCallOptions,
  ): Promise<TranslationOutput> {
    try {
      const response = await runWithDeadline(this.name, deadlineMs, signal, (abortSignal) =>
        this.client.models.generateContent({
          model: this.options.model,
          contents: req.userPrompt,
          config: { systemInstruction: req.systemPrompt, temperature: TEMPERATURE, abortSignal },
        }),
      );
      const meta = response.usageMetadata;
      return {
        text: (response.text ?? "").trim(),
        usage: meta && {
          inputTokens: meta.promptTokenCount,
          // Thinking tokens are billed as output.
          outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
        },
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw classifyError(err, this.name);
    }
  }
}
