import type { MinutesContent } from "@recap/core";
import { describe, expect, it } from "vitest";
import { editReducer } from "./edit-reducer";

const base = (): MinutesContent => ({
  summary: "Tóm tắt",
  topics: [
    {
      id: "t1",
      title: "Giá",
      status: "open",
      keyPoints: [{ text: "Giữ 345", atMs: 1000 }],
      conclusion: null,
    },
    { id: "t2", title: "Tiến độ", status: "decided", keyPoints: [], conclusion: null },
  ],
  actionItems: [{ id: "a1", task: "Gửi báo giá", owner: "Lan", due: null, atMs: null }],
  openIssues: [{ id: "i1", text: "Ai duyệt?" }],
});

describe("editReducer", () => {
  it("adds a blank open topic with the given id", () => {
    const next = editReducer(base(), { type: "topic/add", id: "t3" });
    expect(next.topics.at(-1)).toMatchObject({
      id: "t3",
      title: "",
      status: "open",
      conclusion: null,
    });
  });

  it("moves topics and ignores moves past the ends", () => {
    const down = editReducer(base(), { type: "topic/move", id: "t1", direction: 1 });
    expect(down.topics.map((t) => t.id)).toEqual(["t2", "t1"]);
    const start = base();
    expect(editReducer(start, { type: "topic/move", id: "t1", direction: -1 })).toBe(start);
  });

  it("edits title, status and removes a topic", () => {
    let c = editReducer(base(), { type: "topic/title", id: "t1", title: "Giá bán" });
    c = editReducer(c, { type: "topic/status", id: "t1", status: "rejected" });
    expect(c.topics[0]).toMatchObject({ title: "Giá bán", status: "rejected" });
    c = editReducer(c, { type: "topic/remove", id: "t1" });
    expect(c.topics.map((t) => t.id)).toEqual(["t2"]);
  });

  it("adds, edits and removes key points, keeping the timestamp", () => {
    let c = editReducer(base(), { type: "keyPoint/add", topicId: "t1" });
    expect(c.topics[0]?.keyPoints).toHaveLength(2);
    c = editReducer(c, { type: "keyPoint/set", topicId: "t1", index: 0, text: "Giữ 350" });
    expect(c.topics[0]?.keyPoints[0]).toEqual({ text: "Giữ 350", atMs: 1000 });
    c = editReducer(c, { type: "keyPoint/remove", topicId: "t1", index: 0 });
    expect(c.topics[0]?.keyPoints).toEqual([{ text: "", atMs: null }]);
  });

  it("adds a conclusion once, keeps `marked` on edit, and removes it", () => {
    let c = editReducer(base(), { type: "conclusion/add", topicId: "t1" });
    c = editReducer(c, { type: "conclusion/set", topicId: "t1", text: "Chốt 345" });
    expect(c.topics[0]?.conclusion).toEqual({ text: "Chốt 345", atMs: null, marked: false });
    expect(editReducer(c, { type: "conclusion/add", topicId: "t1" })).toEqual(c);
    c = editReducer(c, { type: "conclusion/remove", topicId: "t1" });
    expect(c.topics[0]?.conclusion).toBeNull();
  });

  it("edits action items and open issues by id", () => {
    let c = editReducer(base(), { type: "action/set", id: "a1", field: "owner", value: "Minh" });
    c = editReducer(c, { type: "action/add", id: "a2" });
    c = editReducer(c, { type: "issue/set", id: "i1", text: "Ai ký?" });
    c = editReducer(c, { type: "issue/add", id: "i2" });
    expect(c.actionItems.map((a) => [a.id, a.owner])).toEqual([
      ["a1", "Minh"],
      ["a2", null],
    ]);
    expect(c.openIssues.map((i) => i.text)).toEqual(["Ai ký?", ""]);
    c = editReducer(c, { type: "action/remove", id: "a1" });
    c = editReducer(c, { type: "issue/remove", id: "i1" });
    expect(c.actionItems).toHaveLength(1);
    expect(c.openIssues).toHaveLength(1);
  });

  it("does not mutate the previous state", () => {
    const before = base();
    const snapshot = JSON.stringify(before);
    editReducer(before, { type: "topic/title", id: "t1", title: "X" });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
