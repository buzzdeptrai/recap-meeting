import type { MinutesContent } from "@recap/core";
import { describe, expect, it } from "vitest";
import { prepareForSave } from "./prepare-save";

const content = (patch: Partial<MinutesContent> = {}): MinutesContent => ({
  summary: " Tóm tắt ",
  topics: [
    {
      id: "t1",
      title: " Giá ",
      status: "decided",
      keyPoints: [
        { text: "Ý chính", atMs: 5000 },
        { text: "   ", atMs: null },
      ],
      conclusion: { text: " ", atMs: null, marked: false },
    },
  ],
  actionItems: [
    { id: "a1", task: "Gửi", owner: " ", due: "Thứ 6", atMs: null },
    { id: "a2", task: "", owner: "Lan", due: null, atMs: null },
  ],
  openIssues: [{ id: "i1", text: "" }],
  ...patch,
});

describe("prepareForSave", () => {
  it("trims and drops blank rows", () => {
    const result = prepareForSave(content());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.summary).toBe("Tóm tắt");
    expect(result.content.topics[0]?.title).toBe("Giá");
    expect(result.content.topics[0]?.keyPoints).toHaveLength(1);
    expect(result.content.topics[0]?.conclusion).toBeNull();
    expect(result.content.actionItems).toEqual([
      { id: "a1", task: "Gửi", owner: null, due: "Thứ 6", atMs: null },
    ]);
    expect(result.content.openIssues).toEqual([]);
  });

  it("refuses an empty summary or a topic without a title", () => {
    expect(prepareForSave(content({ summary: " " })).ok).toBe(false);
    const untitled = content();
    untitled.topics[0]!.title = "";
    expect(prepareForSave(untitled).ok).toBe(false);
  });
});
