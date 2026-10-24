import { describe, expect, it } from "vitest";
import {
  FakeMinutesLlm,
  applyTopicLabels,
  formatBoundary,
  generateMinutes,
  withTopicBoundaries,
} from "../src";
import { splitIntoChunks, type TranscriptLine } from "../src/transcript";
import { counterIds, emptyReply, seed } from "./helpers";

const line = (startMs: number, text = `line ${startMs}`): TranscriptLine => ({
  startMs,
  endMs: startMs + 1_000,
  text,
});

describe("withTopicBoundaries", () => {
  it("formats labelled and unnamed boundaries", () => {
    expect(formatBoundary({ atMs: 65_000, label: "Ngân sách" })).toBe(
      "=== CHỦ ĐỀ: Ngân sách @01:05 ===",
    );
    expect(formatBoundary({ atMs: 0, label: null })).toBe("=== CHỦ ĐỀ: chưa đặt tên @00:00 ===");
  });

  it("puts the boundary before the first line starting at or after the marker", () => {
    const lines = [line(0), line(10_000), line(20_000)];
    const result = withTopicBoundaries(lines, [{ atMs: 10_000, label: "B" }]);
    expect(result.map((l) => l.text)).toEqual([
      "line 0",
      "=== CHỦ ĐỀ: B @00:10 ===",
      "line 10000",
      "line 20000",
    ]);
    expect(result[1]?.boundary).toBe(true);
  });

  it("keeps trailing and leading markers and sorts them", () => {
    const result = withTopicBoundaries(
      [line(5_000)],
      [
        { atMs: 90_000, label: "late" },
        { atMs: 0, label: "first" },
      ],
    );
    expect(result.map((l) => l.text)).toEqual([
      "=== CHỦ ĐỀ: first @00:00 ===",
      "line 5000",
      "=== CHỦ ĐỀ: late @01:30 ===",
    ]);
  });

  it("returns the lines untouched without markers", () => {
    const lines = [line(0)];
    expect(withTopicBoundaries(lines, [])).toBe(lines);
  });
});

describe("applyTopicLabels", () => {
  const topic = (title: string, at: number | null) => ({
    title,
    keyPoints: at === null ? [] : [{ atMs: at }],
    conclusion: null,
  });

  it("gives the first topic of each labelled span the label, later splits keep their title", () => {
    const markers = [
      { atMs: 10_000, label: "Giá" },
      { atMs: 100_000, label: null },
    ];
    const result = applyTopicLabels(
      [
        topic("Mở đầu", 2_000),
        topic("AI-title-1", 12_000),
        topic("AI-split", 50_000),
        topic("AI-unnamed", 110_000),
      ],
      markers,
    );
    expect(result.map((t) => t.title)).toEqual(["Mở đầu", "Giá", "AI-split", "AI-unnamed"]);
  });

  it("leaves topics without timestamps alone", () => {
    const result = applyTopicLabels([topic("x", null)], [{ atMs: 0, label: "L" }]);
    expect(result[0]?.title).toBe("x");
  });
});

describe("generateMinutes with topic markers", () => {
  const segments = [
    { startMs: 0, text: "Mở đầu cuộc họp" },
    { startMs: 30_000, text: "Bàn về ngân sách" },
    { startMs: 70_000, text: "Bàn về nhân sự" },
  ];
  const topics = [{ atMs: 30_000, label: "Ngân sách" }, { atMs: 65_000 }];

  it("passes hard boundaries and rules to the model", async () => {
    const { repos, meetingId } = seed({ segments, topics });
    const llm = new FakeMinutesLlm(emptyReply);
    await generateMinutes({ meetingId, lang: "vi" }, { repos, llm });
    const call = llm.calls[0];
    const user = call?.user ?? "";
    expect(user).toContain("=== CHỦ ĐỀ: Ngân sách @00:30 ===");
    expect(user).toContain("=== CHỦ ĐỀ: chưa đặt tên @01:05 ===");
    expect(user.indexOf("Mở đầu")).toBeLessThan(user.indexOf("@00:30 ==="));
    expect(user.indexOf("@00:30 ===")).toBeLessThan(user.indexOf("Bàn về ngân sách"));
    expect(user.indexOf("Bàn về ngân sách")).toBeLessThan(user.indexOf("@01:05 ==="));
    expect(call?.system).toContain("HARD boundaries");
    expect(call?.system).toContain("verbatim");
  });

  it("does not change behaviour without topic markers", async () => {
    const { repos, meetingId } = seed({ segments });
    const llm = new FakeMinutesLlm(emptyReply);
    await generateMinutes({ meetingId, lang: "vi" }, { repos, llm });
    expect(llm.calls[0]?.user).not.toContain("CHỦ ĐỀ");
    expect(llm.calls[0]?.system).not.toContain("HARD boundaries");
  });

  it("maps labels to titles and assigns ids", async () => {
    const { repos, meetingId } = seed({ segments, topics, marks: [] });
    const llm = new FakeMinutesLlm({
      ...emptyReply,
      topics: [
        {
          title: "Intro",
          keyPoints: [{ text: "a", at: "00:05" }],
          status: "open",
          conclusion: null,
        },
        {
          title: "Budget stuff",
          keyPoints: [{ text: "b", at: "00:35" }],
          status: "open",
          conclusion: null,
        },
        {
          title: "Nhân sự mới",
          keyPoints: [{ text: "c", at: "01:10" }],
          status: "open",
          conclusion: null,
        },
      ],
    });
    const { content } = await generateMinutes(
      { meetingId, lang: "vi" },
      { repos, llm, newId: counterIds() },
    );
    expect(content.topics.map((t) => t.title)).toEqual(["Intro", "Ngân sách", "Nhân sự mới"]);
    expect(content.topics.map((t) => t.id)).toEqual(["id-1", "id-2", "id-3"]);
  });

  it("topic markers never count as conclusion marks", async () => {
    const { repos, meetingId } = seed({ segments, topics });
    const llm = new FakeMinutesLlm(emptyReply);
    const result = await generateMinutes({ meetingId, lang: "vi" }, { repos, llm });
    expect(llm.calls[0]?.user).not.toContain("MARKED CONCLUSIONS");
    expect(result.unmatchedMarks).toEqual([]);
  });
});

describe("map-reduce keeps topic boundaries aligned", () => {
  it("never ends a chunk with a boundary and cuts early at a boundary", () => {
    const lines = withTopicBoundaries(
      Array.from({ length: 10 }, (_, i) => line(i * 10_000, `text ${"x".repeat(30)} ${i}`)),
      [{ atMs: 50_000, label: "Giữa" }],
    );
    const chunks = splitIntoChunks(lines, 100);
    for (const chunk of chunks) expect(chunk.at(-1)?.boundary).toBeUndefined();
    const boundaryChunk = chunks.find((c) => c.some((l) => l.boundary));
    expect(boundaryChunk?.[0]?.boundary).toBe(true);
    expect(chunks.flat()).toEqual(lines);
  });

  it("sends every boundary to exactly one chunk call and lists markers in the reduce call", async () => {
    const long = Array.from({ length: 12 }, (_, i) => ({
      startMs: i * 60_000,
      text: `Nội dung phần ${i} `.repeat(20),
    }));
    const { repos, meetingId } = seed({
      segments: long,
      topics: [
        { atMs: 240_000, label: "Một" },
        { atMs: 480_000, label: "Hai" },
      ],
    });
    const llm = new FakeMinutesLlm((req) =>
      req.user.includes("PARTIAL MINUTES") ? { ...emptyReply, summary: "Final." } : emptyReply,
    );
    await generateMinutes(
      { meetingId, lang: "vi" },
      { repos, llm, config: { singlePassMaxTokens: 100, chunkTokens: 250 } },
    );
    const chunkCalls = llm.calls.filter((c) => !c.user.includes("PARTIAL MINUTES"));
    const reduce = llm.calls.find((c) => c.user.includes("PARTIAL MINUTES"));
    for (const label of ["Một @04:00", "Hai @08:00"]) {
      const holders = chunkCalls.filter((c) => c.user.includes(`=== CHỦ ĐỀ: ${label} ===`));
      expect(holders).toHaveLength(1);
      // the boundary opens its chunk: it is the first transcript line
      const transcript = holders[0]?.user.split("TRANSCRIPT:\n<transcript>\n")[1] ?? "";
      expect(transcript.startsWith(`=== CHỦ ĐỀ: ${label} ===`)).toBe(true);
    }
    expect(reduce?.system).toContain("HARD boundaries");
    expect(reduce?.user).toContain("TOPIC MARKERS:\n=== CHỦ ĐỀ: Một @04:00 ===");
    expect(chunkCalls[0]?.system).toContain("continues the topic of the previous part");
  });
});
