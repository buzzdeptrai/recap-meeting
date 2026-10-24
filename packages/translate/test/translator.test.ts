import { describe, expect, it } from "vitest";
import { FakeProvider, createTranslator, type GlossarySource } from "../src";
import { sleep, testConfig } from "./helpers";

const base = { meetingId: "m1", sourceLang: "en", targetLang: "vi" } as const;

/** Echo provider whose latency depends on the text, so completion order can differ from seq order. */
function delayedByText(delays: Record<string, number>) {
  return new FakeProvider("gemini", (req) => {
    const latest = /\[LATEST TEXT TO TRANSLATE\]:\n([\s\S]*)$/.exec(req.userPrompt)?.[1] ?? "";
    return { latencyMs: delays[latest] ?? 0 };
  });
}

function setup(gemini: FakeProvider, overrides = {}, glossary?: GlossarySource) {
  const openai = new FakeProvider("openai");
  const translator = createTranslator(testConfig({ deadlineMs: 1000, ...overrides }), {
    providers: { gemini, openai },
    glossary,
  });
  return { translator, openai };
}

describe("translator", () => {
  it("returns text, provider, latency and degraded flag", async () => {
    const { translator } = setup(new FakeProvider("gemini"));
    const res = await translator.translate({ ...base, seq: 1, text: "hello" });
    expect(res).toMatchObject({ text: "[fake] hello", provider: "gemini", degraded: false });
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(translator.status()).toEqual({ provider: "gemini", degraded: false });
  });

  it("fills context with previous pairs (max 6) for the next prompt", async () => {
    const gemini = new FakeProvider("gemini");
    const { translator } = setup(gemini);
    for (let seq = 1; seq <= 8; seq++)
      await translator.translate({ ...base, seq, text: `line ${seq}` });
    const lastPrompt = gemini.calls.at(-1)?.userPrompt ?? "";
    expect(lastPrompt).toContain('"line 7" => "[fake] line 7"');
    expect(lastPrompt).toContain('"line 2" => "[fake] line 2"');
    expect(lastPrompt).not.toContain('"line 1"');
    expect(gemini.calls[0]?.userPrompt).toContain("[PREVIOUS CONTEXT (for reference only)]:\nNone");
  });

  it("keeps context separate per meeting and clears it on endMeeting", async () => {
    const gemini = new FakeProvider("gemini");
    const { translator } = setup(gemini);
    await translator.translate({ ...base, seq: 1, text: "alpha" });
    await translator.translate({ ...base, meetingId: "m2", seq: 1, text: "beta" });
    expect(gemini.calls[1]?.userPrompt).not.toContain("alpha");
    translator.endMeeting("m1");
    await translator.translate({ ...base, seq: 2, text: "gamma" });
    expect(gemini.calls[2]?.userPrompt).not.toContain("alpha");
  });

  it("injects matching glossary terms into the prompt", async () => {
    const gemini = new FakeProvider("gemini");
    const glossary: GlossarySource = {
      listTerms: () => [
        {
          term: "ARR",
          lang: "en",
          translation: "doanh thu định kỳ hằng năm",
          doNotTranslate: false,
          priority: 1,
        },
      ],
    };
    const { translator } = setup(gemini, {}, glossary);
    await translator.translate({ ...base, seq: 1, text: "our ARR is up" });
    expect(gemini.calls[0]?.userPrompt).toContain('- "ARR" -> "doanh thu định kỳ hằng năm"');
  });

  it("releases results in seq order even when completion is out of order", async () => {
    const { translator } = setup(delayedByText({ first: 120, second: 10, third: 10 }));
    const emitted: number[] = [];
    const run = (seq: number, text: string) =>
      translator.translate({ ...base, seq, text }).then(() => void emitted.push(seq));
    await Promise.all([run(1, "first"), run(2, "second"), run(3, "third")]);
    expect(emitted).toEqual([1, 2, 3]);
  });

  it("stores context in seq order, so seq 2 never precedes seq 1", async () => {
    const gemini = delayedByText({ first: 80, second: 5 });
    const { translator } = setup(gemini);
    await Promise.all([
      translator.translate({ ...base, seq: 1, text: "first" }),
      translator.translate({ ...base, seq: 2, text: "second" }),
    ]);
    await translator.translate({ ...base, seq: 3, text: "third" });
    const prompt = gemini.calls.at(-1)?.userPrompt ?? "";
    expect(prompt.indexOf('"first"')).toBeGreaterThan(-1);
    expect(prompt.indexOf('"first"')).toBeLessThan(prompt.indexOf('"second"'));
  });

  it("does not let a failed seq block later ones", async () => {
    const boom = (req: { userPrompt: string }) => req.userPrompt.endsWith("boom");
    const gemini = new FakeProvider("gemini", (req) =>
      boom(req) ? { latencyMs: 60, error: "SERVER" } : {},
    );
    const openai = new FakeProvider("openai", (req) => (boom(req) ? { error: "SERVER" } : {}));
    const t = createTranslator(testConfig({ deadlineMs: 1000 }), { providers: { gemini, openai } });
    const [a, b] = await Promise.allSettled([
      t.translate({ ...base, seq: 1, text: "boom" }),
      t.translate({ ...base, seq: 2, text: "fine" }),
    ]);
    expect(a.status).toBe("rejected");
    expect(b.status).toBe("fulfilled");
  });

  it("releases a later seq after the bounded wait when an earlier one hangs, and skips its context", async () => {
    const gemini = delayedByText({ stuck: 600, quick: 5 });
    const { translator } = setup(gemini, { orderTimeoutMs: 80 });
    const started = Date.now();
    const stuck = translator.translate({ ...base, seq: 1, text: "stuck" });
    const quick = translator.translate({ ...base, seq: 2, text: "quick" });
    await quick;
    expect(Date.now() - started).toBeLessThan(400);
    await stuck; // late: still delivered to its own caller
    await sleep(0);
    await translator.translate({ ...base, seq: 3, text: "next" });
    const prompt = gemini.calls.at(-1)?.userPrompt ?? "";
    expect(prompt).toContain('"quick"');
    expect(prompt).not.toContain('"stuck"');
  });

  it("does not wait for seqs that were never submitted (gaps)", async () => {
    const { translator } = setup(new FakeProvider("gemini"));
    const started = Date.now();
    await translator.translate({ ...base, seq: 10, text: "a" });
    await translator.translate({ ...base, seq: 20, text: "b" });
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("reports degraded when it fails over", async () => {
    const { translator } = setup(new FakeProvider("gemini", { error: "SERVER" }));
    const res = await translator.translate({ ...base, seq: 1, text: "hi" });
    expect(res).toMatchObject({ provider: "openai", degraded: true });
    expect(translator.status()).toEqual({ provider: "openai", degraded: true });
  });

  it("rejects empty text and duplicate in-flight seq", async () => {
    const { translator } = setup(new FakeProvider("gemini", { latencyMs: 30 }));
    await expect(translator.translate({ ...base, seq: 1, text: "  " })).rejects.toThrow(/empty/);
    const first = translator.translate({ ...base, seq: 2, text: "x" });
    await expect(translator.translate({ ...base, seq: 2, text: "x" })).rejects.toThrow(/already/);
    await first;
  });
});
