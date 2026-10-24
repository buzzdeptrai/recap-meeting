import { describe, expect, it } from "vitest";
import {
  OpenAiMinutesLlm,
  llmJsonSchema,
  generatorConfigFromEnv,
  minutesConfigFromEnv,
  type OpenAiClientLike,
} from "../src";

describe("minutesConfigFromEnv", () => {
  it("defaults the model to gpt-4.1", () => {
    expect(minutesConfigFromEnv({ OPENAI_API_KEY: "k" })).toMatchObject({ model: "gpt-4.1" });
    expect(minutesConfigFromEnv({ OPENAI_API_KEY: "k", OPENAI_MINUTES_MODEL: " " }).model).toBe(
      "gpt-4.1",
    );
  });

  it("reads overrides and fails without a key, never echoing values", () => {
    const config = minutesConfigFromEnv({
      OPENAI_API_KEY: "k",
      OPENAI_MINUTES_MODEL: "gpt-x",
      OPENAI_MINUTES_DEADLINE_MS: "5000",
    });
    expect(config).toMatchObject({ model: "gpt-x", deadlineMs: 5_000 });
    expect(() => minutesConfigFromEnv({ OPENAI_MINUTES_MODEL: "secret-ish" })).toThrow(
      /OPENAI_API_KEY/,
    );
    expect(() =>
      minutesConfigFromEnv({ OPENAI_API_KEY: "sk-secret", OPENAI_MINUTES_DEADLINE_MS: "abc" }),
    ).toThrow(expect.objectContaining({ message: expect.not.stringContaining("sk-secret") }));
  });
});

describe("generatorConfigFromEnv", () => {
  it("defaults the mark window to 90 s / 15 s, also for blanks and without an API key", () => {
    const defaults = { markWindowBeforeMs: 90_000, markWindowAfterMs: 15_000 };
    expect(generatorConfigFromEnv({})).toEqual(defaults);
    expect(
      generatorConfigFromEnv({
        MINUTES_MARK_WINDOW_BEFORE_MS: " ",
        MINUTES_MARK_WINDOW_AFTER_MS: "",
      }),
    ).toEqual(defaults);
    expect(
      minutesConfigFromEnv({ OPENAI_API_KEY: "k", MINUTES_MARK_WINDOW_BEFORE_MS: "" }),
    ).toBeDefined();
  });

  it("reads overrides within bounds and rejects out-of-range values", () => {
    expect(
      generatorConfigFromEnv({
        MINUTES_MARK_WINDOW_BEFORE_MS: "120000",
        MINUTES_MARK_WINDOW_AFTER_MS: "0",
      }),
    ).toEqual({ markWindowBeforeMs: 120_000, markWindowAfterMs: 0 });
    for (const bad of [
      { MINUTES_MARK_WINDOW_BEFORE_MS: "4999" },
      { MINUTES_MARK_WINDOW_BEFORE_MS: "300001" },
      { MINUTES_MARK_WINDOW_AFTER_MS: "-1" },
      { MINUTES_MARK_WINDOW_AFTER_MS: "60001" },
      { MINUTES_MARK_WINDOW_AFTER_MS: "abc" },
    ]) {
      expect(() => generatorConfigFromEnv(bad)).toThrow(/MINUTES_MARK_WINDOW/);
    }
  });
});

describe("llmJsonSchema", () => {
  it("is a strict-friendly object schema without ids", () => {
    const schema = llmJsonSchema() as {
      properties: Record<string, unknown>;
      required: string[];
      additionalProperties: boolean;
    };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["summary", "topics", "actionItems", "openIssues"]);
    expect(JSON.stringify(schema)).not.toContain('"id"');
    expect(JSON.stringify(schema)).not.toContain("$schema");
  });
});

describe("OpenAiMinutesLlm", () => {
  const request = {
    system: "s",
    user: "u",
    schemaName: "meeting_minutes",
    jsonSchema: { type: "object" },
  };

  it("sends a strict json_schema request with low temperature", async () => {
    let params: Record<string, unknown> = {};
    const client: OpenAiClientLike = {
      chat: {
        completions: {
          create: async (p) => {
            params = p;
            return { choices: [{ message: { content: '{"ok":1}' } }] };
          },
        },
      },
    };
    const llm = new OpenAiMinutesLlm({ apiKey: "k", model: "gpt-x", deadlineMs: 1_000 }, client);
    expect(await llm.generate(request)).toBe('{"ok":1}');
    expect(params).toMatchObject({
      model: "gpt-x",
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: { name: "meeting_minutes", strict: true },
      },
    });
  });

  it("aborts at the deadline", async () => {
    const client: OpenAiClientLike = {
      chat: {
        completions: {
          create: (_p, { signal }) =>
            new Promise((_, reject) =>
              signal.addEventListener("abort", () => reject(new Error("aborted"))),
            ),
        },
      },
    };
    const llm = new OpenAiMinutesLlm({ apiKey: "k", model: "m", deadlineMs: 20 }, client);
    await expect(llm.generate(request)).rejects.toMatchObject({ code: "LLM_FAILED" });
  });

  it("reports usage events for success and failure, and survives a throwing hook", async () => {
    const events: unknown[] = [];
    let fail = false;
    const client: OpenAiClientLike = {
      chat: {
        completions: {
          create: async () => {
            if (fail) throw new Error("boom");
            return {
              choices: [{ message: { content: "{}" } }],
              usage: { prompt_tokens: 1000, completion_tokens: 200 },
            };
          },
        },
      },
    };
    const llm = new OpenAiMinutesLlm(
      { apiKey: "k", model: "gpt-x", deadlineMs: 1_000 },
      client,
      (e) => events.push(e),
    );
    await llm.generate(request);
    fail = true;
    await expect(llm.generate(request)).rejects.toThrow("boom");
    expect(events).toEqual([
      expect.objectContaining({
        model: "gpt-x",
        inputTokens: 1000,
        outputTokens: 200,
        status: "ok",
      }),
      expect.objectContaining({ status: "error", inputTokens: null }),
    ]);

    const throwing = new OpenAiMinutesLlm(
      { apiKey: "k", model: "m", deadlineMs: 1_000 },
      {
        chat: {
          completions: { create: async () => ({ choices: [{ message: { content: "{}" } }] }) },
        },
      },
      () => {
        throw new Error("recorder down");
      },
    );
    await expect(throwing.generate(request)).resolves.toBe("{}");
  });
});
