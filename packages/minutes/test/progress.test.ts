import { describe, expect, it } from "vitest";
import { FakeMinutesLlm, generateMinutes, PROMPT_VERSION, type MinutesProgress } from "../src";
import { emptyReply, seed } from "./helpers";

const long = Array.from({ length: 12 }, (_, i) => ({
  startMs: i * 60_000,
  text: `Nội dung phần ${i} `.repeat(20),
}));
const config = { singlePassMaxTokens: 100, chunkTokens: 250 };

function collect() {
  const events: MinutesProgress[] = [];
  return { events, onProgress: (p: MinutesProgress) => void events.push({ ...p }) };
}

describe("generateMinutes onProgress", () => {
  it("reports each chunk of a map-reduce run, then reduce and finalize", async () => {
    const { repos, meetingId } = seed({ segments: long });
    const llm = new FakeMinutesLlm(emptyReply);
    const { events, onProgress } = collect();
    await generateMinutes({ meetingId, lang: "vi" }, { repos, llm, config, onProgress });

    const chunks = llm.calls.length - 1;
    expect(chunks).toBeGreaterThan(1);
    const map = events.filter((e) => e.phase === "map");
    expect(map.map((e) => e.done)).toEqual(Array.from({ length: chunks + 1 }, (_, i) => i));
    expect(map.every((e) => e.total === chunks)).toBe(true);
    expect(events.slice(-2)).toEqual([
      { phase: "reduce", done: chunks, total: chunks },
      { phase: "finalize", done: chunks, total: chunks },
    ]);
  });

  it("reports total 1 for a single pass", async () => {
    const { repos, meetingId } = seed({ segments: long.slice(0, 2) });
    const { events, onProgress } = collect();
    await generateMinutes(
      { meetingId, lang: "vi" },
      { repos, llm: new FakeMinutesLlm(emptyReply), onProgress },
    );
    expect(events).toEqual([
      { phase: "map", done: 0, total: 1 },
      { phase: "finalize", done: 1, total: 1 },
    ]);
  });

  it("produces identical output with and without a callback", async () => {
    const ids = () => {
      let n = 0;
      return () => `id-${++n}`;
    };
    const { repos, meetingId } = seed({ segments: long, marks: [30_000] });
    const run = async (onProgress?: (p: MinutesProgress) => void) => {
      return generateMinutes(
        { meetingId, lang: "vi" },
        { repos, llm: new FakeMinutesLlm(emptyReply), config, newId: ids(), onProgress },
      );
    };
    expect(await run(() => undefined)).toEqual(await run());
  });

  it("does not let a throwing callback break generation", async () => {
    const { repos, meetingId } = seed({ segments: long.slice(0, 2) });
    const result = await generateMinutes(
      { meetingId, lang: "vi" },
      {
        repos,
        llm: new FakeMinutesLlm(emptyReply),
        onProgress: () => {
          throw new Error("sink down");
        },
      },
    );
    expect(result.content.summary).toBe("Tóm tắt.");
  });

  it("returns the prompt version and marks fingerprint it used", async () => {
    const { repos, meetingId } = seed({ segments: long.slice(0, 2), marks: [5_000] });
    const result = await generateMinutes(
      { meetingId, lang: "vi" },
      { repos, llm: new FakeMinutesLlm(emptyReply) },
    );
    expect(result.promptVersion).toBe(PROMPT_VERSION);
    expect(result.marksFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});
