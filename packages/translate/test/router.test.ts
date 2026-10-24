import { describe, expect, it } from "vitest";
import { CircuitBreaker, DEFAULT_BREAKER_CONFIG } from "../src/circuit-breaker";
import { AllProvidersFailedError } from "../src/errors";
import { FakeProvider } from "../src/providers/fake";
import { createRouter } from "../src/router";
import { ManualClock } from "./helpers";

const REQ = { systemPrompt: "s", userPrompt: "[LATEST TEXT TO TRANSLATE]:\nxin chào" };

function setup(
  gemini: FakeProvider,
  openai: FakeProvider,
  extra: { slowDeadlineMs?: number; fallbackDeadlineMs?: number } = {},
) {
  const clock = new ManualClock();
  const breaker = new CircuitBreaker(DEFAULT_BREAKER_CONFIG, clock);
  const router = createRouter({
    providers: { gemini, openai },
    order: ["gemini", "openai"],
    deadlineMs: 40,
    fallbackDeadlineMs: extra.fallbackDeadlineMs,
    slowDeadlineMs: extra.slowDeadlineMs ?? 0,
    breaker,
  });
  return { router, breaker, clock };
}

describe("router", () => {
  it("uses the primary and is not degraded", async () => {
    const { router } = setup(new FakeProvider("gemini"), new FakeProvider("openai"));
    const res = await router.translate(REQ);
    expect(res).toMatchObject({ provider: "gemini", degraded: false, text: "[fake] xin chào" });
    expect(router.status()).toEqual({ provider: "gemini", degraded: false });
  });

  it("fails over on error and reports degraded", async () => {
    const { router } = setup(
      new FakeProvider("gemini", { error: "SERVER" }),
      new FakeProvider("openai"),
    );
    const res = await router.translate(REQ);
    expect(res).toMatchObject({ provider: "openai", degraded: true });
    expect(router.status()).toEqual({ provider: "openai", degraded: true });
  });

  it("enforces the per-provider deadline then fails over", async () => {
    const slow = new FakeProvider("gemini", { latencyMs: 500 });
    const { router } = setup(slow, new FakeProvider("openai"));
    const started = Date.now();
    const res = await router.translate(REQ);
    expect(res.provider).toBe("openai");
    expect(Date.now() - started).toBeLessThan(300);
  });

  it("gives fallback providers their own, longer deadline", async () => {
    const gemini = new FakeProvider("gemini", { latencyMs: 500 });
    const slowFallback = new FakeProvider("openai", { latencyMs: 100 });
    const { router } = setup(gemini, slowFallback, { fallbackDeadlineMs: 400 });
    expect(await router.translate(REQ)).toMatchObject({ provider: "openai", degraded: true });
  });

  it("applies the primary deadline to a fallback when no fallback deadline is set", async () => {
    const gemini = new FakeProvider("gemini", { error: "SERVER" });
    const { router } = setup(gemini, new FakeProvider("openai", { latencyMs: 100 }));
    await expect(router.translate(REQ)).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it("skips a provider whose breaker is open", async () => {
    const gemini = new FakeProvider("gemini", { error: "SERVER" });
    const { router, breaker } = setup(gemini, new FakeProvider("openai"));
    for (let i = 0; i < 3; i++) await router.translate(REQ);
    expect(breaker.state("gemini")).toBe("open");
    await router.translate(REQ);
    expect(gemini.calls).toHaveLength(3);
  });

  it("does not retry 429/402 on the same provider", async () => {
    const gemini = new FakeProvider("gemini", { error: "RATE_LIMIT" });
    const { router } = setup(gemini, new FakeProvider("openai"), { slowDeadlineMs: 100 });
    await router.translate(REQ);
    expect(gemini.calls).toHaveLength(1);
  });

  it("retries a timed-out provider once on the slow path when all fail", async () => {
    const gemini = new FakeProvider("gemini", [{ latencyMs: 500 }, { text: "late but ok" }]);
    const { router } = setup(gemini, new FakeProvider("openai", { error: "SERVER" }), {
      slowDeadlineMs: 200,
    });
    const res = await router.translate(REQ);
    expect(res).toMatchObject({ provider: "gemini", text: "late but ok" });
    expect(gemini.calls).toHaveLength(2);
  });

  it("throws AllProvidersFailedError with attempts when nothing answers", async () => {
    const { router } = setup(
      new FakeProvider("gemini", { error: "SERVER" }),
      new FakeProvider("openai", { error: "AUTH" }),
    );
    const err = await router.translate(REQ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AllProvidersFailedError);
    expect((err as AllProvidersFailedError).attempts.map((a) => a.code)).toEqual([
      "SERVER",
      "AUTH",
    ]);
  });

  it("treats empty output as a failure", async () => {
    const { router } = setup(
      new FakeProvider("gemini", { text: "  " }),
      new FakeProvider("openai"),
    );
    expect((await router.translate(REQ)).provider).toBe("openai");
  });
});
