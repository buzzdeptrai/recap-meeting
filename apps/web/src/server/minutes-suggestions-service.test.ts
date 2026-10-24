import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { beforeEach, describe, expect, it } from "vitest";
import { loadMinutesSuggestions } from "./minutes-suggestions-service";

let repos: Repositories;

const content = (title: string) => ({
  summary: "tóm tắt",
  topics: [
    {
      id: "t1",
      title,
      keyPoints: [{ text: "ý", atMs: 5_000 }],
      status: "open" as const,
      conclusion: { text: "Chốt", atMs: 9_000, marked: false },
    },
  ],
  actionItems: [],
  openIssues: [],
});

function meeting(ended: boolean, targetLang: "vi" | "en" = "vi") {
  const created = repos.meetings.create({ title: "Họp", targetLang });
  if (!ended) return created;
  repos.meetings.start(created.id);
  return repos.meetings.end(created.id) ?? created;
}

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
});

describe("loadMinutesSuggestions", () => {
  it("returns nothing while the meeting is not ended", () => {
    const m = meeting(false);
    repos.minutes.upsert({ meetingId: m.id, lang: "vi", content: content("A"), source: "ai" });
    expect(loadMinutesSuggestions(m, repos).topics).toEqual([]);
  });

  it("returns nothing when there are no minutes", () => {
    expect(loadMinutesSuggestions(meeting(true), repos)).toEqual({ topics: [], conclusions: [] });
  });

  it("prefers the target language, else any language that exists", () => {
    const m = meeting(true, "en");
    repos.minutes.upsert({ meetingId: m.id, lang: "vi", content: content("VI"), source: "ai" });
    expect(loadMinutesSuggestions(m, repos).topics[0]?.title).toBe("VI");
    repos.minutes.upsert({ meetingId: m.id, lang: "en", content: content("EN"), source: "ai" });
    expect(loadMinutesSuggestions(m, repos).topics[0]?.title).toBe("EN");
  });

  it("stays silent when stored minutes are corrupt", () => {
    const m = meeting(true);
    repos.minutes.upsert({ meetingId: m.id, lang: "vi", content: content("A"), source: "ai" });
    const broken = {
      ...repos,
      minutes: {
        ...repos.minutes,
        get: () => {
          throw new Error("bad json");
        },
      },
    };
    expect(loadMinutesSuggestions(m, broken as Repositories)).toEqual({
      topics: [],
      conclusions: [],
    });
  });
});
