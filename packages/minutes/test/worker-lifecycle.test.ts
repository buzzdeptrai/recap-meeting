import type { UsageEventInput } from "@recap/core";
import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeMinutesLlm, RESTART_RUN_ERROR, type LlmFactory, type MinutesWorker } from "../src";
import { buildWorker, endedMeeting, reply, waitFor } from "./worker-helpers";

let repos: Repositories;
const usage: UsageEventInput[] = [];
const workers: MinutesWorker[] = [];

function makeWorker(createLlm: LlmFactory) {
  const worker = buildWorker(repos, usage, createLlm);
  workers.push(worker);
  return worker;
}

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
});
afterEach(async () => {
  await Promise.all(workers.splice(0).map((w) => w.stop()));
});

describe("startup recovery", () => {
  it("fails runs left running by a dead process, keeps queued ones, is repeatable, no requeue", async () => {
    const dead = repos.minutesRuns.start({ meetingId: endedMeeting(repos), lang: "vi" }).run;
    repos.minutesRuns.markRunning(dead.id);
    const waiting = repos.minutesRuns.start({ meetingId: endedMeeting(repos), lang: "vi" }).run;
    const worker = makeWorker(() => new FakeMinutesLlm(reply));

    expect(worker.recoverOnStartup()).toBe(1);
    expect(worker.recoverOnStartup()).toBe(0);
    expect(repos.minutesRuns.get(dead.id)).toMatchObject({
      status: "failed",
      error: RESTART_RUN_ERROR,
    });
    expect(repos.minutesRuns.get(waiting.id)?.status).toBe("queued");
    worker.tick();
    await worker.whenIdle();
    expect(repos.minutesRuns.get(waiting.id)?.status).toBe("done");
    expect(repos.minutesRuns.get(dead.id)?.status).toBe("failed");
  });

  it("start() recovers before polling", () => {
    const dead = repos.minutesRuns.start({ meetingId: endedMeeting(repos), lang: "vi" }).run;
    repos.minutesRuns.markRunning(dead.id);
    const worker = makeWorker(() => new FakeMinutesLlm(reply));
    worker.start();
    expect(repos.minutesRuns.get(dead.id)?.error).toBe(RESTART_RUN_ERROR);
  });
});

describe("graceful shutdown", () => {
  it("stops polling, fails in-flight runs with the restart message and never stores late minutes", async () => {
    const meetingId = endedMeeting(repos);
    const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
    let release: () => void = () => {};
    const llm = new FakeMinutesLlm(
      () =>
        new Promise((resolve) => {
          release = () => resolve(reply);
        }),
    );
    const worker = makeWorker(() => llm);
    worker.start();
    await waitFor(() => llm.calls.length === 1);

    await worker.stop();
    expect(worker.status().running).toBe(false);
    expect(repos.minutesRuns.get(run.id)).toMatchObject({
      status: "failed",
      error: RESTART_RUN_ERROR,
    });

    release();
    await new Promise((r) => setTimeout(r, 30));
    expect(repos.minutesRuns.get(run.id)?.status).toBe("failed");
    expect(repos.minutes.get(meetingId, "vi")).toBeUndefined();

    repos.minutesRuns.start({ meetingId, lang: "vi" });
    expect(worker.tick()).toBe(0);
    await worker.stop(); // idempotent
  });
});
