import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

function meetingIn(repos: ReturnType<typeof setup>["repos"]) {
  return repos.meetings.create({ title: "m" }).id;
}

describe("minutes runs repository", () => {
  it("starts a queued run with zero progress", () => {
    const { repos } = setup();
    const meetingId = meetingIn(repos);
    const { run, created } = repos.minutesRuns.start({ meetingId, lang: "vi", model: "m1" });
    expect(created).toBe(true);
    expect(run).toMatchObject({
      meetingId,
      lang: "vi",
      status: "queued",
      phase: null,
      doneChunks: 0,
      totalChunks: 0,
      error: null,
      model: "m1",
      finishedAt: null,
    });
  });

  it("is idempotent while a run is queued or running", () => {
    const { repos } = setup();
    const meetingId = meetingIn(repos);
    const first = repos.minutesRuns.start({ meetingId, lang: "vi" });
    const second = repos.minutesRuns.start({ meetingId, lang: "vi" });
    expect(second.created).toBe(false);
    expect(second.run.id).toBe(first.run.id);
    repos.minutesRuns.markRunning(first.run.id);
    expect(repos.minutesRuns.start({ meetingId, lang: "vi" }).run.id).toBe(first.run.id);
    // another language is independent
    expect(repos.minutesRuns.start({ meetingId, lang: "en" }).created).toBe(true);
  });

  it("allows a new run once the previous one finished, and latest returns the newest", () => {
    const { repos, advance } = setup();
    const meetingId = meetingIn(repos);
    const a = repos.minutesRuns.start({ meetingId, lang: "vi" }).run;
    repos.minutesRuns.finish(a.id);
    advance(1_000);
    const b = repos.minutesRuns.start({ meetingId, lang: "vi" });
    expect(b.created).toBe(true);
    expect(repos.minutesRuns.latest(meetingId, "vi")?.id).toBe(b.run.id);
    expect(repos.minutesRuns.latest(meetingId, "en")).toBeUndefined();
  });

  it("records progress and moves to running", () => {
    const { repos, advance } = setup();
    const meetingId = meetingIn(repos);
    const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
    advance(500);
    expect(repos.minutesRuns.updateProgress(run.id, { phase: "map", done: 2, total: 5 })).toBe(
      true,
    );
    const after = repos.minutesRuns.get(run.id);
    expect(after).toMatchObject({ status: "running", phase: "map", doneChunks: 2, totalChunks: 5 });
    expect(after?.updatedAt).not.toBe(run.updatedAt);
  });

  it("finish / fail / cancel are terminal and never resurrect a run", () => {
    const { repos } = setup();
    const meetingId = meetingIn(repos);
    const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
    repos.minutesRuns.fail(run.id, "Lỗi an toàn");
    const failed = repos.minutesRuns.get(run.id);
    expect(failed).toMatchObject({ status: "failed", error: "Lỗi an toàn" });
    expect(failed?.finishedAt).not.toBeNull();
    expect(repos.minutesRuns.updateProgress(run.id, { phase: "map", done: 1, total: 2 })).toBe(
      false,
    );
    expect(repos.minutesRuns.finish(run.id)).toBe(false);
    expect(repos.minutesRuns.get(run.id)?.status).toBe("failed");

    const next = repos.minutesRuns.start({ meetingId, lang: "vi" }).run;
    expect(repos.minutesRuns.finish(next.id)).toBe(true);
    expect(repos.minutesRuns.get(next.id)).toMatchObject({ status: "done", error: null });
    const third = repos.minutesRuns.start({ meetingId, lang: "vi" }).run;
    expect(repos.minutesRuns.cancel(third.id)).toBe(true);
    expect(repos.minutesRuns.get(third.id)?.status).toBe("cancelled");
  });

  it("lists running (queued + running) runs only", () => {
    const { repos } = setup();
    const a = meetingIn(repos);
    const b = meetingIn(repos);
    const runA = repos.minutesRuns.start({ meetingId: a, lang: "vi" }).run;
    const runB = repos.minutesRuns.start({ meetingId: b, lang: "vi" }).run;
    repos.minutesRuns.markRunning(runA.id);
    repos.minutesRuns.finish(runB.id);
    expect(repos.minutesRuns.listActive().map((r) => r.id)).toEqual([runA.id]);
  });

  it("failStale fails only active runs not updated since the cutoff, and is repeatable", () => {
    const { repos, advance } = setup();
    const meetingId = meetingIn(repos);
    const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
    repos.minutesRuns.markRunning(run.id);
    const cutoffFresh = new Date(Date.parse(run.updatedAt) - 1).toISOString();
    expect(repos.minutesRuns.failStale(meetingId, "vi", cutoffFresh, "timeout")).toBe(0);
    advance(60_000);
    const cutoffOld = new Date(Date.parse(run.updatedAt) + 30_000).toISOString();
    expect(repos.minutesRuns.failStale(meetingId, "vi", cutoffOld, "timeout")).toBe(1);
    expect(repos.minutesRuns.failStale(meetingId, "vi", cutoffOld, "timeout")).toBe(0);
    expect(repos.minutesRuns.get(run.id)).toMatchObject({ status: "failed", error: "timeout" });
  });

  it("cascades on meeting delete", () => {
    const { repos, db } = setup();
    const meetingId = meetingIn(repos);
    repos.minutesRuns.start({ meetingId, lang: "vi" });
    repos.meetings.remove(meetingId);
    expect(db.prepare("SELECT COUNT(*) FROM minutes_runs").pluck().get()).toBe(0);
  });
});
