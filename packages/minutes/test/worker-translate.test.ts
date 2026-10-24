import type { MinutesContent, UsageEventInput } from "@recap/core";
import {
  IN_MEMORY,
  createRepositories,
  minutesContentHash,
  openDatabase,
  type Repositories,
} from "@recap/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FakeMinutesLlm,
  GENERIC_TRANSLATE_ERROR,
  TRANSLATE_PROMPT_VERSION,
  OpenAiMinutesLlm,
  createMinutesWorker,
  type MinutesWorker,
  type OpenAiClientLike,
} from "../src";
import { endedMeeting, reply } from "./worker-helpers";

const translated = {
  summary: "Chốt giá.",
  topics: [{ title: "Giá", keyPoints: ["Giảm 5%"], conclusion: "Chốt 95" }],
  actionItems: [],
  openIssues: [],
};

let repos: Repositories;
let usage: UsageEventInput[];
let sourceLlm: FakeMinutesLlm;
let translateLlm: FakeMinutesLlm;
const workers: MinutesWorker[] = [];

function makeWorker(withTranslation = true) {
  const worker = createMinutesWorker({
    runs: repos.minutesRuns,
    minutes: repos.minutes,
    repos,
    createLlm: () => sourceLlm,
    createTranslateLlm: withTranslation ? () => translateLlm : undefined,
    usage: (e) => usage.push(e),
    pollMs: 10,
    concurrency: 1,
    log: () => {},
  });
  workers.push(worker);
  return worker;
}

async function drain(worker: MinutesWorker) {
  while (worker.tick() > 0) await worker.whenIdle();
  await worker.whenIdle();
}

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
  usage = [];
  sourceLlm = new FakeMinutesLlm(reply);
  translateLlm = new FakeMinutesLlm(translated, "translate-model");
});
afterEach(async () => {
  await Promise.all(workers.splice(0).map((w) => w.stop()));
});

describe("generate then translate pipeline", () => {
  it("marks the source run done first, queues the translation, then derives the other language", async () => {
    const meetingId = endedMeeting(repos);
    const { run: gen } = repos.minutesRuns.start({ meetingId, lang: "en" });
    const worker = makeWorker();
    expect(worker.tick()).toBe(1);
    await worker.whenIdle();

    // Source is usable and done; the translation waits in the queue.
    expect(repos.minutesRuns.get(gen.id)?.status).toBe("done");
    expect(repos.minutes.get(meetingId, "en")).toMatchObject({ derivedFromLang: null });
    const queued = repos.minutesRuns.latest(meetingId, "vi");
    expect(queued).toMatchObject({ kind: "translate", status: "queued", overwrite: false });
    expect(repos.minutes.get(meetingId, "vi")).toBeUndefined();

    await drain(worker);
    const source = repos.minutes.get(meetingId, "en")!;
    expect(repos.minutesRuns.get(queued!.id)?.status).toBe("done");
    expect(repos.minutes.get(meetingId, "vi")).toMatchObject({
      source: "ai",
      derivedFromLang: "en",
      sourceHash: minutesContentHash(source.content),
      model: "translate-model",
      promptVersion: TRANSLATE_PROMPT_VERSION,
    });
    expect(repos.minutes.get(meetingId, "vi")?.content.topics[0]).toMatchObject({
      id: source.content.topics[0]?.id,
      status: "decided",
    });
  });

  it("meters translation calls as service translate with the translation model", async () => {
    const meetingId = endedMeeting(repos);
    repos.minutesRuns.start({ meetingId, lang: "vi", kind: "translate" });
    repos.minutes.upsert({
      meetingId,
      lang: "en",
      content: { summary: "S", topics: [], actionItems: [], openIssues: [] },
      source: "ai",
    });
    const client: OpenAiClientLike = {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "T",
                    topics: [],
                    actionItems: [],
                    openIssues: [],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 7, completion_tokens: 3 },
          }),
        },
      },
    };
    const worker = createMinutesWorker({
      runs: repos.minutesRuns,
      minutes: repos.minutes,
      repos,
      createLlm: () => sourceLlm,
      createTranslateLlm: (onUsage) =>
        new OpenAiMinutesLlm({ apiKey: "k", model: "mini-x", deadlineMs: 1_000 }, client, onUsage),
      usage: (e) => usage.push(e),
      pollMs: 10,
      concurrency: 1,
      log: () => {},
    });
    workers.push(worker);
    await drain(worker);
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      meetingId,
      vendor: "openai",
      service: "translate",
      model: "mini-x",
      inputTokens: 7,
      outputTokens: 3,
      meta: { kind: "minutes" },
    });
    expect(repos.minutes.get(meetingId, "vi")?.model).toBe("mini-x");
  });

  it("does not queue a translation when the worker has no translation model", async () => {
    const meetingId = endedMeeting(repos);
    repos.minutesRuns.start({ meetingId, lang: "en" });
    await drain(makeWorker(false));
    expect(repos.minutesRuns.latest(meetingId, "vi")).toBeUndefined();
  });

  it("a failing translation leaves the source intact and shows a retryable error", async () => {
    const meetingId = endedMeeting(repos);
    translateLlm = new FakeMinutesLlm(() => {
      throw new Error("down");
    });
    repos.minutesRuns.start({ meetingId, lang: "en" });
    await drain(makeWorker());
    const before = repos.minutes.get(meetingId, "en");
    expect(before).toBeDefined();
    expect(repos.minutesRuns.latest(meetingId, "vi")).toMatchObject({
      kind: "translate",
      status: "failed",
      error: GENERIC_TRANSLATE_ERROR,
    });
    expect(repos.minutes.get(meetingId, "vi")).toBeUndefined();

    // Retry: a new translate run succeeds.
    translateLlm = new FakeMinutesLlm(translated);
    repos.minutesRuns.start({ meetingId, lang: "vi", kind: "translate" });
    await drain(makeWorker());
    expect(repos.minutes.get(meetingId, "vi")?.derivedFromLang).toBe("en");
    expect(repos.minutes.get(meetingId, "en")?.content).toEqual(before?.content);
  });

  it("regenerating the source re-translates automatically", async () => {
    const meetingId = endedMeeting(repos);
    repos.minutesRuns.start({ meetingId, lang: "en" });
    const worker = makeWorker();
    await drain(worker);
    const first = repos.minutes.get(meetingId, "vi")!;
    sourceLlm = new FakeMinutesLlm({ ...reply, summary: "New summary." });
    repos.minutesRuns.start({ meetingId, lang: "en" });
    await drain(worker);
    const second = repos.minutes.get(meetingId, "vi")!;
    expect(second.sourceHash).not.toBe(first.sourceHash);
    expect(second.sourceHash).toBe(minutesContentHash(repos.minutes.get(meetingId, "en")!.content));
  });
});

describe("overwrite protection", () => {
  async function withEditedTranslation() {
    const meetingId = endedMeeting(repos);
    repos.minutesRuns.start({ meetingId, lang: "en" });
    const worker = makeWorker();
    await drain(worker);
    const derived = repos.minutes.get(meetingId, "vi")!;
    const content: MinutesContent = { ...derived.content, summary: "Bản tôi sửa tay." };
    repos.minutes.upsert({ meetingId, lang: "vi", content, source: "edited" });
    return { meetingId, worker };
  }

  it("regenerating the source does not queue a translation over hand edits", async () => {
    const { meetingId, worker } = await withEditedTranslation();
    const before = repos.minutesRuns.latest(meetingId, "vi");
    repos.minutesRuns.start({ meetingId, lang: "en" });
    await drain(worker);
    expect(repos.minutesRuns.latest(meetingId, "vi")?.id).toBe(before?.id);
    expect(repos.minutes.get(meetingId, "vi")).toMatchObject({
      source: "edited",
      content: expect.objectContaining({ summary: "Bản tôi sửa tay." }),
    });
  });

  it("an unconfirmed translate run is refused by the worker; a confirmed one replaces", async () => {
    const { meetingId, worker } = await withEditedTranslation();
    repos.minutesRuns.start({ meetingId, lang: "vi", kind: "translate" });
    await drain(worker);
    expect(repos.minutesRuns.latest(meetingId, "vi")).toMatchObject({ status: "failed" });
    expect(repos.minutes.get(meetingId, "vi")?.source).toBe("edited");

    repos.minutesRuns.start({ meetingId, lang: "vi", kind: "translate", overwrite: true });
    await drain(worker);
    expect(repos.minutes.get(meetingId, "vi")).toMatchObject({
      source: "ai",
      derivedFromLang: "en",
    });
  });

  it("fails clearly when the source minutes do not exist", async () => {
    const meetingId = endedMeeting(repos);
    repos.minutesRuns.start({ meetingId, lang: "vi", kind: "translate" });
    await drain(makeWorker());
    expect(repos.minutesRuns.latest(meetingId, "vi")).toMatchObject({
      status: "failed",
      error: "Chưa có biên bản gốc để dịch.",
    });
  });
});
