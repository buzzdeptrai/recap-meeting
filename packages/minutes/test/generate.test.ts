import { describe, expect, it } from "vitest";
import { FakeMinutesLlm, MinutesError, generateMinutes } from "../src";
import { counterIds, emptyReply, seed } from "./helpers";

const reply = {
  summary: "Hai bên chốt giá.",
  topics: [
    {
      title: "Giá",
      keyPoints: [{ text: "Giảm 5%", at: "00:10" }],
      status: "decided",
      conclusion: { text: "Chốt 95 triệu", at: "01:30", marked: true },
    },
    { title: "Giao hàng", keyPoints: [], status: "open", conclusion: null },
  ],
  actionItems: [
    { task: "Gửi báo giá", owner: "Minh", due: "31/10", at: "01:35" },
    { task: "Kiểm tra kho", owner: "Bob", due: "next Friday", at: null },
  ],
  openIssues: [{ text: "Thời hạn thanh toán?" }],
};

const segments = [
  { startMs: 10_000, text: "Giảm 5% nhé", channel: 1 as const },
  { startMs: 90_000, text: "Chốt 95 triệu, anh Minh gửi báo giá trước 31/10", channel: 1 as const },
  { startMs: 200_000, text: "Còn giao hàng", channel: 0 as const },
];

describe("generateMinutes", () => {
  it("assigns ids itself, sets marked from real marks and grounds owners/dates", async () => {
    const { repos, meetingId } = seed({ segments, marks: [92_000] });
    const llm = new FakeMinutesLlm(reply);
    const result = await generateMinutes(
      { meetingId, lang: "vi" },
      { repos, llm, newId: counterIds() },
    );
    const { content } = result;
    expect(content.topics.map((t) => t.id)).toEqual(["id-1", "id-2"]);
    expect(content.actionItems.map((a) => a.id)).toEqual(["id-3", "id-4"]);
    expect(content.openIssues[0]?.id).toBe("id-5");
    expect(content.topics[0]?.conclusion).toEqual({
      text: "Chốt 95 triệu",
      atMs: 90_000,
      marked: true,
    });
    expect(content.topics[0]?.keyPoints[0]?.atMs).toBe(10_000);
    expect(content.actionItems[0]).toMatchObject({ owner: "Minh", due: "31/10", atMs: 95_000 });
    // "Bob" and "next Friday" never appear in the transcript digits/names -> owner dropped
    expect(content.actionItems[1]).toMatchObject({ owner: null, atMs: null });
    expect(result.model).toBe("fake-model");
    expect(result.unmatchedMarks).toEqual([]);
  });

  it("uses random uuids by default and ignores ids the model sneaks in", async () => {
    const { repos, meetingId } = seed({ segments, marks: [] });
    const llm = new FakeMinutesLlm({ ...reply, topics: [{ ...reply.topics[0], id: "evil" }] });
    const { content } = await generateMinutes({ meetingId, lang: "vi" }, { repos, llm });
    expect(content.topics[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("does not flag marked when no mark backs the conclusion, and reports unmatched marks", async () => {
    const { repos, meetingId } = seed({ segments, marks: [190_000] });
    const llm = new FakeMinutesLlm(reply);
    const result = await generateMinutes({ meetingId, lang: "vi" }, { repos, llm });
    expect(result.content.topics[0]?.conclusion?.marked).toBe(false);
    expect(result.unmatchedMarks).toEqual([190_000]);
  });

  it("drops timestamps beyond the end of the meeting", async () => {
    const { repos, meetingId } = seed({ segments, marks: [] });
    const llm = new FakeMinutesLlm({
      ...emptyReply,
      topics: [
        { title: "x", keyPoints: [{ text: "k", at: "99:00" }], status: "open", conclusion: null },
      ],
    });
    const { content } = await generateMinutes({ meetingId, lang: "vi" }, { repos, llm });
    expect(content.topics[0]?.keyPoints[0]?.atMs).toBeNull();
  });

  it("sends the 90 s before / 15 s after window for each mark and the right language", async () => {
    const { repos, meetingId } = seed({
      segments: [
        { startMs: 0, text: "far before" },
        {
          startMs: 56_000,
          text: "inside before",
          lang: "en",
          translation: { lang: "vi", text: "bản dịch" },
        },
        { startMs: 128_000, text: "inside after" },
        { startMs: 131_000, text: "far after" },
      ],
      marks: [115_000],
    });
    const llm = new FakeMinutesLlm(emptyReply);
    await generateMinutes({ meetingId, lang: "vi" }, { repos, llm });
    const user = llm.calls[0]?.user ?? "";
    const markBlock = user.slice(user.indexOf("MARKED CONCLUSIONS"));
    expect(markBlock).toContain("Mark 1 at [01:55]");
    expect(markBlock).toContain("bản dịch");
    expect(markBlock).toContain("inside after");
    expect(markBlock).not.toContain("far before");
    expect(markBlock).not.toContain("far after");
    expect(user.slice(0, user.indexOf("MARKED CONCLUSIONS"))).toContain("far before");
    expect(llm.calls[0]?.system).toContain("Vietnamese");
    expect(llm.calls[0]?.system).toContain("marked");
    expect(llm.calls[0]?.system).toContain("90 seconds before the mark up to 15 seconds after");
  });

  it("uses the configured window and states it in the prompt", async () => {
    const { repos, meetingId } = seed({
      segments: [
        { startMs: 10_000, text: "too early" },
        { startMs: 50_000, text: "in window" },
      ],
      marks: [60_000],
    });
    const llm = new FakeMinutesLlm(emptyReply);
    const config = { markWindowBeforeMs: 20_000, markWindowAfterMs: 0 };
    await generateMinutes({ meetingId, lang: "vi" }, { repos, llm, config });
    const user = llm.calls[0]?.user ?? "";
    const markBlock = user.slice(user.indexOf("MARKED CONCLUSIONS"));
    expect(markBlock).toContain("in window");
    expect(markBlock).not.toContain("too early");
    expect(llm.calls[0]?.system).toContain("20 seconds before the mark up to 0 seconds after");
  });

  it("keeps the mark window inside the topic and before the next topic marker", async () => {
    const { repos, meetingId } = seed({
      segments: [
        { startMs: 10_000, text: "previous topic talk" },
        { startMs: 50_000, text: "same topic talk" },
        { startMs: 70_000, text: "next topic talk" },
      ],
      marks: [65_000],
      topics: [{ atMs: 40_000, label: "Giá" }, { atMs: 68_000 }],
    });
    const llm = new FakeMinutesLlm(emptyReply);
    await generateMinutes({ meetingId, lang: "vi" }, { repos, llm });
    const user = llm.calls[0]?.user ?? "";
    const markBlock = user.slice(user.indexOf("MARKED CONCLUSIONS"));
    expect(markBlock).toContain("same topic talk");
    expect(markBlock).not.toContain("previous topic talk");
    expect(markBlock).not.toContain("next topic talk");
    // the full transcript is untouched
    const full = user.slice(0, user.indexOf("MARKED CONCLUSIONS"));
    expect(full).toContain("previous topic talk");
    expect(full).toContain("next topic talk");
  });

  it("asks for English output and includes glossary and agenda", async () => {
    const { repos, meetingId } = seed({
      segments,
      agenda: "1. Pricing",
    });
    repos.glossary.create({ term: "PO", lang: "en", translation: "đơn đặt hàng" });
    const llm = new FakeMinutesLlm(emptyReply);
    await generateMinutes({ meetingId, lang: "en" }, { repos, llm });
    const call = llm.calls[0];
    expect(call?.system).toContain("English");
    expect(call?.system).not.toContain("MARKED CONCLUSIONS");
    expect(call?.user).toContain("AGENDA:\n1. Pricing");
    expect(call?.user).toContain("PO (en) = đơn đặt hàng");
  });

  it("errors on unknown meeting and on empty transcript", async () => {
    const { repos, meetingId } = seed({ segments: [] });
    const llm = new FakeMinutesLlm(emptyReply);
    await expect(
      generateMinutes({ meetingId: "nope", lang: "vi" }, { repos, llm }),
    ).rejects.toMatchObject({ code: "MEETING_NOT_FOUND" });
    await expect(generateMinutes({ meetingId, lang: "vi" }, { repos, llm })).rejects.toMatchObject({
      code: "EMPTY_TRANSCRIPT",
    });
    expect(llm.calls).toHaveLength(0);
  });
});

describe("invalid output handling", () => {
  it("retries once on invalid JSON and then succeeds", async () => {
    const { repos, meetingId } = seed({ segments });
    const llm = new FakeMinutesLlm(["not json {", emptyReply]);
    const { content } = await generateMinutes({ meetingId, lang: "vi" }, { repos, llm });
    expect(content.summary).toBe("Tóm tắt.");
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1]?.user).toContain("previous reply was rejected");
  });

  it("retries once on schema-invalid JSON", async () => {
    const { repos, meetingId } = seed({ segments });
    const llm = new FakeMinutesLlm([{ summary: 1 }, emptyReply]);
    await generateMinutes({ meetingId, lang: "vi" }, { repos, llm });
    expect(llm.calls).toHaveLength(2);
  });

  it("gives up with INVALID_OUTPUT after the retry", async () => {
    const { repos, meetingId } = seed({ segments });
    const llm = new FakeMinutesLlm("garbage");
    const err = await generateMinutes({ meetingId, lang: "vi" }, { repos, llm }).catch((e) => e);
    expect(err).toBeInstanceOf(MinutesError);
    expect(err.code).toBe("INVALID_OUTPUT");
    expect(llm.calls).toHaveLength(2);
  });

  it("wraps LLM transport errors as LLM_FAILED without retrying", async () => {
    const { repos, meetingId } = seed({ segments });
    const llm = new FakeMinutesLlm(() => {
      throw new Error("boom");
    });
    await expect(generateMinutes({ meetingId, lang: "vi" }, { repos, llm })).rejects.toMatchObject({
      code: "LLM_FAILED",
    });
    expect(llm.calls).toHaveLength(1);
  });

  it("fails validation when the model returns an over-long field", async () => {
    const { repos, meetingId } = seed({ segments });
    const llm = new FakeMinutesLlm({ ...emptyReply, summary: "x".repeat(5_000) });
    await expect(generateMinutes({ meetingId, lang: "vi" }, { repos, llm })).rejects.toMatchObject({
      code: "INVALID_OUTPUT",
    });
  });
});

describe("map-reduce", () => {
  const long = Array.from({ length: 12 }, (_, i) => ({
    startMs: i * 60_000,
    text: `Nội dung phần ${i} `.repeat(20),
  }));
  const config = { singlePassMaxTokens: 100, chunkTokens: 250 };

  it("summarises chunks then reduces, keeping marks with their chunk", async () => {
    const { repos, meetingId } = seed({ segments: long, marks: [30_000, 600_000] });
    const llm = new FakeMinutesLlm((req) =>
      req.user.includes("PARTIAL MINUTES")
        ? { ...reply, summary: "Final." }
        : { ...emptyReply, summary: "Part." },
    );
    const { content } = await generateMinutes({ meetingId, lang: "vi" }, { repos, llm, config });
    const chunkCalls = llm.calls.filter((c) => !c.user.includes("PARTIAL MINUTES"));
    const reduceCalls = llm.calls.filter((c) => c.user.includes("PARTIAL MINUTES"));
    expect(chunkCalls.length).toBeGreaterThan(1);
    expect(reduceCalls).toHaveLength(1);
    expect(llm.calls.at(-1)).toBe(reduceCalls[0]);
    expect(content.summary).toBe("Final.");
    // every mark window goes to exactly one chunk call
    const withMark = (label: string) => chunkCalls.filter((c) => c.user.includes(label)).length;
    expect(withMark("at [00:30]")).toBe(1);
    expect(withMark("at [10:00]")).toBe(1);
    expect(reduceCalls[0]?.user).toContain("MARKS AT: 00:30, 10:00");
    expect(reduceCalls[0]?.user).toContain("--- PART 1 ---");
  });

  it("stays single pass for short transcripts", async () => {
    const { repos, meetingId } = seed({ segments });
    const llm = new FakeMinutesLlm(emptyReply);
    await generateMinutes({ meetingId, lang: "vi" }, { repos, llm });
    expect(llm.calls).toHaveLength(1);
  });

  it("retries an invalid chunk reply independently", async () => {
    const { repos, meetingId } = seed({ segments: long });
    let first = true;
    const llm = new FakeMinutesLlm(() => {
      if (first) {
        first = false;
        return "oops";
      }
      return emptyReply;
    });
    await generateMinutes({ meetingId, lang: "vi" }, { repos, llm, config });
    const chunkCount = llm.calls.filter((c) => !c.user.includes("PARTIAL MINUTES")).length;
    expect(chunkCount).toBeGreaterThan(2);
  });
});
