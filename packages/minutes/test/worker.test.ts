import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { UsageEventInput } from "@recap/core";
import { createRepositories, openDatabase, IN_MEMORY, type Repositories } from "@recap/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GENERIC, SMALL_CHUNKS, endedMeeting, reply, waitFor, buildWorker } from "./worker-helpers";
import {
  FakeMinutesLlm,
  MinutesError,
  OpenAiMinutesLlm,
  PROMPT_VERSION,
  type LlmFactory,
  type MinutesWorker,
  type OpenAiClientLike,
} from "../src";

/** Real OpenAI wrapper (so metering is the production path) over a scripted client. */
function openAiFactory(client: OpenAiClientLike): LlmFactory {
  return (onUsage) =>
    new OpenAiMinutesLlm({ apiKey: "test-key", model: "m1", deadlineMs: 1_000 }, client, onUsage);
}

const okClient = (onCall: () => void = () => {}): OpenAiClientLike & { calls: number } => {
  const client = {
    calls: 0,
    chat: {
      completions: {
        create: async () => {
          client.calls += 1;
          onCall();
          return {
            choices: [{ message: { content: JSON.stringify(reply) } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          };
        },
      },
    },
  };
  return client;
};

let repos: Repositories;
let usage: UsageEventInput[];
const workers: MinutesWorker[] = [];

function makeWorker(createLlm: LlmFactory, over: Parameters<typeof buildWorker>[3] = {}) {
  const worker = buildWorker(repos, usage, createLlm, over);
  workers.push(worker);
  return worker;
}

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
  usage = [];
});
afterEach(async () => {
  await Promise.all(workers.splice(0).map((w) => w.stop()));
});

describe("minutes worker", () => {
  it("runs a queued run to done: stores stamped minutes and meters each LLM call once", async () => {
    const meetingId = endedMeeting(repos);
    const client = okClient();
    const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
    const worker = makeWorker(openAiFactory(client));
    expect(worker.tick()).toBe(1);
    await worker.whenIdle();

    expect(repos.minutesRuns.get(run.id)).toMatchObject({ status: "done", error: null });
    expect(repos.minutes.get(meetingId, "vi")).toMatchObject({
      source: "ai",
      model: "m1",
      promptVersion: PROMPT_VERSION,
    });
    expect(repos.minutes.get(meetingId, "vi")?.marksFingerprint).toEqual(expect.any(String));
    expect(usage).toHaveLength(client.calls);
    expect(usage[0]).toMatchObject({
      meetingId,
      vendor: "openai",
      service: "minutes",
      model: "m1",
      inputTokens: 10,
      outputTokens: 5,
      status: "ok",
    });
  });

  it("writes map -> reduce progress for a long meeting and meters every call", async () => {
    const meetingId = endedMeeting(repos, 12);
    const seen: Array<{ phase: string | null; done: number; total: number; status: string }> = [];
    const client = okClient(() => {
      const run = repos.minutesRuns.latest(meetingId, "vi");
      if (run) {
        seen.push({
          phase: run.phase,
          done: run.doneChunks,
          total: run.totalChunks,
          status: run.status,
        });
      }
    });
    const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
    const worker = makeWorker(openAiFactory(client), { config: SMALL_CHUNKS });
    worker.tick();
    await worker.whenIdle();

    const chunks = client.calls - 1;
    expect(chunks).toBeGreaterThan(1);
    expect(seen.map((s) => s.done).slice(0, chunks)).toEqual(
      Array.from({ length: chunks }, (_, i) => i),
    );
    expect(seen.every((s) => s.status === "running" && s.total === chunks)).toBe(true);
    expect(seen.at(-1)?.phase).toBe("reduce");
    expect(repos.minutesRuns.get(run.id)).toMatchObject({ status: "done", totalChunks: chunks });
    expect(usage).toHaveLength(client.calls);
  });

  it("meters a failed call too, and fails the run with a safe message (no key / prompt leak)", async () => {
    const meetingId = endedMeeting(repos);
    const client: OpenAiClientLike = {
      chat: {
        completions: {
          create: async () => {
            throw new Error("sk-SECRET-KEY exploded: prompt was 'xin chao'");
          },
        },
      },
    };
    const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
    const worker = makeWorker(openAiFactory(client));
    worker.tick();
    await worker.whenIdle();

    const after = repos.minutesRuns.get(run.id);
    expect(after?.status).toBe("failed");
    expect(after?.error).toBeTruthy();
    expect(after?.error).not.toMatch(/sk-|SECRET|prompt|xin chao/);
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ status: "error" });
    expect(JSON.stringify(usage)).not.toMatch(/sk-|SECRET|xin chao/);
    expect(repos.minutes.get(meetingId, "vi")).toBeUndefined();
    expect(repos.minutesRuns.listActive()).toEqual([]);
  });

  it("maps invalid output, missing config and unexpected factory errors to curated messages", async () => {
    const cases: Array<[LlmFactory, string]> = [
      [
        () => new FakeMinutesLlm("garbage"),
        "Mô hình trả về kết quả không hợp lệ. Vui lòng thử lại.",
      ],
      [
        () => {
          throw new MinutesError("OPENAI_API_KEY is required sk-LEAK", "CONFIG");
        },
        "Chưa cấu hình dịch vụ tạo biên bản.",
      ],
      [
        () => {
          throw new Error("sk-LEAK");
        },
        GENERIC,
      ],
    ];
    for (const [factory, expected] of cases) {
      const meetingId = endedMeeting(repos);
      const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
      const worker = makeWorker(factory);
      worker.tick();
      await worker.whenIdle();
      expect(repos.minutesRuns.get(run.id)).toMatchObject({ status: "failed", error: expected });
    }
  });

  it("never leaves a row running after an unexpected exception (finally guard)", async () => {
    const meetingId = endedMeeting(repos);
    const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
    const worker = makeWorker(() => new FakeMinutesLlm(reply), {
      repos: Object.assign(Object.create(repos), {
        minutes: {
          upsert() {
            throw new Error("disk full");
          },
        },
      }),
    });
    worker.tick();
    await worker.whenIdle();
    expect(repos.minutesRuns.get(run.id)).toMatchObject({ status: "failed", error: GENERIC });
  });

  it("claims one run at a time with concurrency 1 and two with concurrency 2", async () => {
    const gate: Array<() => void> = [];
    const factory: LlmFactory = () =>
      new FakeMinutesLlm(
        () =>
          new Promise((resolve) => {
            gate.push(() => resolve(reply));
          }),
      );
    for (const concurrency of [1, 2]) {
      repos = createRepositories(openDatabase(IN_MEMORY));
      gate.length = 0;
      for (let i = 0; i < 3; i++) {
        repos.minutesRuns.start({ meetingId: endedMeeting(repos), lang: "vi" });
      }
      const worker = makeWorker(factory, { concurrency });
      expect(worker.tick()).toBe(concurrency);
      expect(worker.tick()).toBe(0);
      expect(repos.minutesRuns.listActive().filter((r) => r.status === "running")).toHaveLength(
        concurrency,
      );
      await new Promise((r) => setTimeout(r, 20));
      gate.splice(0).forEach((open) => open());
      await worker.whenIdle();
      await worker.stop();
    }
  });

  it("two workers on one database file never run the same row", async () => {
    const dir = mkdtempSync(join(tmpdir(), "recap-worker-"));
    const path = join(dir, "w.db");
    const dbA = openDatabase(path);
    const dbB = openDatabase(path);
    try {
      const a = createRepositories(dbA);
      const b = createRepositories(dbB);
      const meetingId = endedMeeting(a);
      a.minutesRuns.start({ meetingId, lang: "vi" });
      const llmA = new FakeMinutesLlm(reply);
      const llmB = new FakeMinutesLlm(reply);
      const workerA = makeWorker(() => llmA, { repos: a });
      const workerB = makeWorker(() => llmB, { repos: b });
      const claimed = [workerA.tick(), workerB.tick()];
      await Promise.all([workerA.whenIdle(), workerB.whenIdle()]);
      expect(claimed.reduce((x, y) => x + y, 0)).toBe(1);
      expect(llmA.calls.length + llmB.calls.length).toBe(1);
      expect(a.minutesRuns.latest(meetingId, "vi")?.status).toBe("done");
    } finally {
      await Promise.all(workers.splice(0).map((w) => w.stop()));
      dbA.close();
      dbB.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the poll loop picks up a run enqueued after start", async () => {
    const worker = makeWorker(() => new FakeMinutesLlm(reply));
    worker.start();
    expect(worker.status()).toMatchObject({ running: true, pollMs: 10 });
    const { run } = repos.minutesRuns.start({ meetingId: endedMeeting(repos), lang: "vi" });
    await waitFor(() => repos.minutesRuns.get(run.id)?.status === "done");
  });
});
