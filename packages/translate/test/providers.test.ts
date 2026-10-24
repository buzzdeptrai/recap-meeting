import { describe, expect, it } from "vitest";
import { GeminiProvider } from "../src/providers/gemini";
import { OpenAIProvider } from "../src/providers/openai";

const REQ = { systemPrompt: "sys", userPrompt: "user" };

function hang(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) =>
    signal.addEventListener("abort", () => reject(new Error("aborted"))),
  );
}

describe("providers (stub clients)", () => {
  it("gemini returns trimmed text and passes model/system prompt", async () => {
    let seen: unknown;
    const p = new GeminiProvider({
      apiKey: "k",
      model: "m-g",
      client: {
        models: { generateContent: async (params) => ((seen = params), { text: " Xin chào \n" }) },
      },
    });
    expect(await p.translate(REQ, { deadlineMs: 100 })).toEqual({ text: "Xin chào" });
    expect(seen).toMatchObject({
      model: "m-g",
      contents: "user",
      config: { systemInstruction: "sys" },
    });
  });

  it("gemini aborts at the deadline with TIMEOUT", async () => {
    const p = new GeminiProvider({
      apiKey: "k",
      model: "m",
      client: { models: { generateContent: (params) => hang(params.config.abortSignal) } },
    });
    await expect(p.translate(REQ, { deadlineMs: 20 })).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("openai maps messages, model and HTTP status codes", async () => {
    const mk = (impl: () => Promise<never>) =>
      new OpenAIProvider({
        apiKey: "k",
        model: "m-o",
        client: { chat: { completions: { create: impl } } },
      });
    const ok = new OpenAIProvider({
      apiKey: "k",
      model: "m-o",
      client: {
        chat: {
          completions: { create: async () => ({ choices: [{ message: { content: " Hello " } }] }) },
        },
      },
    });
    expect(await ok.translate(REQ, { deadlineMs: 100 })).toEqual({ text: "Hello" });

    const rate = mk(() => Promise.reject(Object.assign(new Error("slow down"), { status: 429 })));
    await expect(rate.translate(REQ, { deadlineMs: 100 })).rejects.toMatchObject({
      code: "RATE_LIMIT",
    });
    const quota = mk(() => Promise.reject(Object.assign(new Error("pay"), { status: 402 })));
    await expect(quota.translate(REQ, { deadlineMs: 100 })).rejects.toMatchObject({
      code: "QUOTA",
    });
  });

  it("external abort yields ABORTED", async () => {
    const p = new OpenAIProvider({
      apiKey: "k",
      model: "m",
      client: { chat: { completions: { create: (_p, o) => hang(o.signal) } } },
    });
    const ctl = new AbortController();
    const pending = p.translate(REQ, { deadlineMs: 1000, signal: ctl.signal });
    ctl.abort();
    await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
  });
});
