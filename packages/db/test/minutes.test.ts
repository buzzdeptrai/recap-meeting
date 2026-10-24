import type { MinutesContent } from "@recap/core";
import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

const content: MinutesContent = {
  summary: "Tóm tắt",
  topics: [
    {
      id: "t1",
      title: "Giá",
      keyPoints: [{ text: "a", atMs: 1 }],
      status: "decided",
      conclusion: { text: "ok", atMs: 2, marked: true },
    },
  ],
  actionItems: [],
  openIssues: [],
};

describe("minutes repository", () => {
  it("returns undefined when nothing is stored", () => {
    const { repos } = setup();
    const meeting = repos.meetings.create({ title: "m" });
    expect(repos.minutes.get(meeting.id, "vi")).toBeUndefined();
  });

  it("stores per language and reads content back", () => {
    const { repos } = setup();
    const meeting = repos.meetings.create({ title: "m" });
    const saved = repos.minutes.upsert({
      meetingId: meeting.id,
      lang: "vi",
      content,
      source: "ai",
      model: "gpt-x",
    });
    expect(saved).toMatchObject({ lang: "vi", source: "ai", model: "gpt-x", content });
    expect(repos.minutes.get(meeting.id, "en")).toBeUndefined();
  });

  it("edit keeps generatedAt and model, regenerate resets them", () => {
    const { repos, advance } = setup();
    const meeting = repos.meetings.create({ title: "m" });
    const first = repos.minutes.upsert({
      meetingId: meeting.id,
      lang: "vi",
      content,
      source: "ai",
      model: "gpt-x",
    });
    advance(1_000);
    const edited = repos.minutes.upsert({
      meetingId: meeting.id,
      lang: "vi",
      content: { ...content, summary: "Sửa" },
      source: "edited",
    });
    expect(edited.source).toBe("edited");
    expect(edited.model).toBe("gpt-x");
    expect(edited.generatedAt).toBe(first.generatedAt);
    expect(edited.updatedAt).not.toBe(first.updatedAt);
    expect(edited.content.summary).toBe("Sửa");

    advance(1_000);
    const again = repos.minutes.upsert({
      meetingId: meeting.id,
      lang: "vi",
      content,
      source: "ai",
      model: "gpt-y",
    });
    expect(again).toMatchObject({ source: "ai", model: "gpt-y" });
    expect(again.generatedAt).not.toBe(first.generatedAt);
  });

  it("rejects invalid content and cascades on meeting delete", () => {
    const { repos, db } = setup();
    const meeting = repos.meetings.create({ title: "m" });
    expect(() =>
      repos.minutes.upsert({
        meetingId: meeting.id,
        lang: "vi",
        content: { ...content, summary: "" },
        source: "ai",
      }),
    ).toThrow();
    repos.minutes.upsert({ meetingId: meeting.id, lang: "en", content, source: "ai" });
    repos.meetings.remove(meeting.id);
    expect(db.prepare("SELECT COUNT(*) FROM minutes").pluck().get()).toBe(0);
  });
});
