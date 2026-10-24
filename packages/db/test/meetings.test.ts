import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

const MINUTE_MS = 60_000;

describe("meetings repository", () => {
  it("creates a draft meeting with camelCase fields", () => {
    const { repos } = setup();
    const meeting = repos.meetings.create({
      title: "Weekly",
      sourceLang: "multi",
      targetLang: "vi",
    });
    expect(meeting).toEqual({
      id: "id-1",
      title: "Weekly",
      status: "draft",
      sourceLang: "multi",
      targetLang: "vi",
      agenda: null,
      createdAt: "2026-10-21T09:00:00.000Z",
      startedAt: null,
      endedAt: null,
      durationMs: null,
    });
    expect(repos.meetings.get("id-1")).toEqual(meeting);
    expect(repos.meetings.get("missing")).toBeUndefined();
  });

  it("lists newest first with limit/offset", () => {
    const { repos, advance } = setup();
    for (const title of ["a", "b", "c"]) {
      repos.meetings.create({ title });
      advance(1);
    }
    expect(repos.meetings.list().map((m) => m.title)).toEqual(["c", "b", "a"]);
    expect(repos.meetings.list({ limit: 1, offset: 1 }).map((m) => m.title)).toEqual(["b"]);
  });

  it("updates title and status", () => {
    const { repos } = setup();
    const { id } = repos.meetings.create({ title: "x" });
    expect(repos.meetings.updateTitle(id, "Renamed")?.title).toBe("Renamed");
    expect(repos.meetings.updateStatus(id, "live")?.status).toBe("live");
    expect(() => repos.meetings.updateStatus(id, "bogus" as "live")).toThrow();
  });

  it("start/end tracks timestamps and duration, keeping started_at on resume", () => {
    const { repos, advance } = setup();
    const { id } = repos.meetings.create({ title: "x" });
    const started = repos.meetings.start(id);
    expect(started?.status).toBe("live");
    advance(5 * MINUTE_MS);
    repos.meetings.end(id);
    const resumed = repos.meetings.start(id);
    expect(resumed?.startedAt).toBe(started?.startedAt);
    expect(resumed?.endedAt).toBeNull();
    advance(5 * MINUTE_MS);
    const ended = repos.meetings.end(id);
    expect(ended?.status).toBe("ended");
    expect(ended?.durationMs).toBe(10 * MINUTE_MS);
    expect(repos.meetings.end("missing")).toBeUndefined();
  });

  it("end() with recorded audio length overrides wall-clock duration", () => {
    const { repos, advance } = setup();
    const { id } = repos.meetings.create({ title: "x" });
    repos.meetings.start(id);
    advance(10 * MINUTE_MS);
    expect(repos.meetings.end(id, undefined, 3 * MINUTE_MS + 400.4)?.durationMs).toBe(
      3 * MINUTE_MS + 400,
    );
  });

  it("remove cascades to segments and marks", () => {
    const { repos, db } = setup();
    const { id } = repos.meetings.create({ title: "x" });
    repos.segments.insert({
      meetingId: id,
      seq: 0,
      channel: 0,
      lang: "vi",
      startMs: 0,
      endMs: 1,
      text: "a",
    });
    repos.marks.insert({ meetingId: id, kind: "conclusion", atMs: 5 });
    expect(repos.meetings.remove(id)).toBe(true);
    expect(db.prepare("SELECT COUNT(*) FROM segments").pluck().get()).toBe(0);
    expect(db.prepare("SELECT COUNT(*) FROM marks").pluck().get()).toBe(0);
  });
});
