import { describe, expect, it } from "vitest";
import { minutesContentSchema, minutesLangSchema, topicStatusSchema } from "../src";

const valid = {
  summary: "Hai bên thống nhất giá.",
  topics: [
    {
      id: "t1",
      title: "Giá",
      keyPoints: [{ text: "Giảm 5%", atMs: 1_000 }],
      status: "decided",
      conclusion: { text: "Chốt 95", atMs: 2_000, marked: true },
    },
  ],
  actionItems: [{ id: "a1", task: "Gửi báo giá", owner: null, due: null, atMs: null }],
  openIssues: [{ id: "i1", text: "Thời hạn thanh toán?" }],
};

describe("minutes schema", () => {
  it("accepts valid content", () => {
    expect(minutesContentSchema.parse(valid)).toEqual(valid);
  });

  it("accepts a topic without conclusion and empty lists", () => {
    const content = { summary: "x", topics: [], actionItems: [], openIssues: [] };
    expect(minutesContentSchema.safeParse(content).success).toBe(true);
    const open = { ...valid, topics: [{ ...valid.topics[0], status: "open", conclusion: null }] };
    expect(minutesContentSchema.safeParse(open).success).toBe(true);
  });

  it("rejects bad status, negative atMs, empty ids and empty summary", () => {
    const bad = (patch: object) => minutesContentSchema.safeParse({ ...valid, ...patch }).success;
    expect(bad({ topics: [{ ...valid.topics[0], status: "maybe" }] })).toBe(false);
    expect(bad({ topics: [{ ...valid.topics[0], keyPoints: [{ text: "x", atMs: -1 }] }] })).toBe(
      false,
    );
    expect(bad({ actionItems: [{ ...valid.actionItems[0], id: "" }] })).toBe(false);
    expect(bad({ summary: "  " })).toBe(false);
  });

  it("validates lang and status enums", () => {
    expect(minutesLangSchema.safeParse("en").success).toBe(true);
    expect(minutesLangSchema.safeParse("fr").success).toBe(false);
    expect(topicStatusSchema.options).toEqual(["decided", "open", "rejected"]);
  });
});
