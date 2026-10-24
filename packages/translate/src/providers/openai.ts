import OpenAI from "openai";
import { ProviderError, classifyError } from "../errors";
import type {
  ProviderCallOptions,
  TranslationOutput,
  TranslationProvider,
  TranslationRequest,
} from "../types";
import { runWithDeadline } from "./deadline";

/** The slice of the openai client this provider uses (injectable for tests). */
export interface OpenAIClientLike {
  chat: {
    completions: {
      create(
        params: { model: string; messages: { role: "system" | "user"; content: string }[] },
        options: { signal: AbortSignal },
      ): Promise<{
        choices: { message: { content?: string | null } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
      }>;
    };
  };
}

export interface OpenAIProviderOptions {
  apiKey: string;
  model: string;
  client?: OpenAIClientLike;
}

export class OpenAIProvider implements TranslationProvider {
  readonly name = "openai";
  readonly model: string;
  private readonly client: OpenAIClientLike;

  constructor(private readonly options: OpenAIProviderOptions) {
    this.model = options.model;
    this.client =
      options.client ??
      (new OpenAI({ apiKey: options.apiKey, maxRetries: 0 }) as unknown as OpenAIClientLike);
  }

  async translate(
    req: TranslationRequest,
    { signal, deadlineMs }: ProviderCallOptions,
  ): Promise<TranslationOutput> {
    try {
      const response = await runWithDeadline(this.name, deadlineMs, signal, (abortSignal) =>
        this.client.chat.completions.create(
          {
            model: this.options.model,
            messages: [
              { role: "system", content: req.systemPrompt },
              { role: "user", content: req.userPrompt },
            ],
          },
          { signal: abortSignal },
        ),
      );
      const usage = response.usage;
      return {
        text: (response.choices[0]?.message.content ?? "").trim(),
        usage: usage
          ? { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens }
          : undefined,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw classifyError(err, this.name);
    }
  }
}
