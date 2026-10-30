import { describe, expect, it, vi } from "vitest";
import {
  LLM_MAX_ATTEMPTS,
  LLM_RETRY_MAX_DELAY_MS,
  MinutesError,
  OpenAiMinutesLlm,
  isRetryableLlmError,
  retryAfterMs,
  withLlmRetry,
  type OpenAiClientLike,
} from "../src";

const httpError = (status: number, headers?: unknown) =>
  Object.assign(new Error(`HTTP ${status}`), { status, headers });

const REPLY = { choices: [{ message: { content: "{}" } }], usage: null };
const CONFIG = { apiKey: "k", model: "m", deadlineMs: 1_000 };
const REQUEST = { system: "s", user: "u", schemaName: "n", jsonSchema: {} };

describe("isRetryableLlmError", () => {
  it("retries 429, 5xx and network errors, never other 4xx", () => {
    expect(isRetryableLlmError(httpError(429))).toBe(true);
    expect(isRetryableLlmError(httpError(500))).toBe(true);
    expect(isRetryableLlmError(httpError(503))).toBe(true);
    expect(isRetryableLlmError(httpError(400))).toBe(false);
    expect(isRetryableLlmError(httpError(401))).toBe(false);
    expect(isRetryableLlmError(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe(true);
    expect(isRetryableLlmError(Object.assign(new Error("x"), { name: "APIConnectionError" }))).toBe(
      true,
    );
    expect(isRetryableLlmError(new Error("boom"))).toBe(false);
    expect(isRetryableLlmError(new MinutesError("deadline", "LLM_FAILED"))).toBe(false);
  });
});

describe("retryAfterMs", () => {
  it("reads seconds and HTTP dates from plain or Headers-like objects", () => {
    expect(retryAfterMs(httpError(429, { "retry-after": "3" }), 0)).toBe(3_000);
    expect(retryAfterMs(httpError(429, new Headers({ "retry-after": "2" })), 0)).toBe(2_000);
    const date = new Date(10_000).toUTCString();
    expect(retryAfterMs(httpError(429, { "retry-after": date }), 4_000)).toBe(6_000);
    expect(retryAfterMs(httpError(429, { "retry-after": "soon" }), 0)).toBeUndefined();
    expect(retryAfterMs(httpError(429), 0)).toBeUndefined();
  });
});

describe("withLlmRetry", () => {
  const sleeps: number[] = [];
  const options = {
    sleep: (ms: number) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    random: () => 0.5,
  };

  it("backs off exponentially with jitter, then succeeds", async () => {
    sleeps.length = 0;
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce("ok");
    await expect(withLlmRetry(attempt, options)).resolves.toBe("ok");
    expect(sleeps).toEqual([1_125, 2_250]);
  });

  it("honours Retry-After (capped) instead of the backoff", async () => {
    sleeps.length = 0;
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(httpError(429, { "retry-after": "7" }))
      .mockRejectedValueOnce(httpError(429, { "retry-after": "999" }))
      .mockResolvedValueOnce("ok");
    await withLlmRetry(attempt, options);
    expect(sleeps).toEqual([7_000, LLM_RETRY_MAX_DELAY_MS]);
  });

  it("gives up after the attempt limit with the last error", async () => {
    sleeps.length = 0;
    const attempt = vi.fn().mockRejectedValue(httpError(500));
    await expect(withLlmRetry(attempt, options)).rejects.toMatchObject({ status: 500 });
    expect(attempt).toHaveBeenCalledTimes(LLM_MAX_ATTEMPTS);
    expect(sleeps).toHaveLength(LLM_MAX_ATTEMPTS - 1);
  });

  it("does not retry a non-retryable error", async () => {
    const attempt = vi.fn().mockRejectedValue(httpError(400));
    await expect(withLlmRetry(attempt, options)).rejects.toMatchObject({ status: 400 });
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});

describe("OpenAiMinutesLlm retry", () => {
  const FAST = { sleep: () => Promise.resolve(), random: () => 0 };

  function clientFailing(times: number, error: unknown) {
    const create = vi.fn().mockImplementation(() => {
      if (create.mock.calls.length <= times) return Promise.reject(error);
      return Promise.resolve(REPLY);
    });
    return { create, client: { chat: { completions: { create } } } as OpenAiClientLike };
  }

  it("survives a 429 and meters the logical call once", async () => {
    const { create, client } = clientFailing(1, httpError(429));
    const onUsage = vi.fn();
    const llm = new OpenAiMinutesLlm(CONFIG, client, onUsage, FAST);
    await expect(llm.generate(REQUEST)).resolves.toBe("{}");
    expect(create).toHaveBeenCalledTimes(2);
    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({ status: "ok" }));
  });

  it("throws the original error once retries are exhausted, metered once as error", async () => {
    const { create, client } = clientFailing(99, httpError(503));
    const onUsage = vi.fn();
    const llm = new OpenAiMinutesLlm(CONFIG, client, onUsage, FAST);
    await expect(llm.generate(REQUEST)).rejects.toMatchObject({ status: 503 });
    expect(create).toHaveBeenCalledTimes(LLM_MAX_ATTEMPTS);
    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
  });

  it("does not retry a 401", async () => {
    const { create, client } = clientFailing(99, httpError(401));
    const llm = new OpenAiMinutesLlm(CONFIG, client, undefined, FAST);
    await expect(llm.generate(REQUEST)).rejects.toMatchObject({ status: 401 });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not retry its own deadline abort", async () => {
    const create = vi.fn(
      (_params: unknown, options: { signal: AbortSignal }) =>
        new Promise<never>((_resolve, reject) =>
          options.signal.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    const llm = new OpenAiMinutesLlm(
      { ...CONFIG, deadlineMs: 10 },
      { chat: { completions: { create } } } as unknown as OpenAiClientLike,
      undefined,
      FAST,
    );
    await expect(llm.generate(REQUEST)).rejects.toMatchObject({ code: "LLM_FAILED" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
