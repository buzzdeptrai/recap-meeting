import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUEUED_CLAIM_TIMEOUT_MS,
  DEFAULT_WORKER_CONCURRENCY,
  DEFAULT_WORKER_POLL_MS,
  minutesWorkerConfigFromEnv,
  queuedClaimTimeoutMsFromEnv,
} from "../src";

describe("worker config from env", () => {
  it("uses defaults when unset, blank or invalid", () => {
    for (const env of [{}, { MINUTES_WORKER_POLL_MS: "", MINUTES_WORKER_CONCURRENCY: "abc" }]) {
      expect(minutesWorkerConfigFromEnv(env)).toEqual({
        pollMs: DEFAULT_WORKER_POLL_MS,
        concurrency: DEFAULT_WORKER_CONCURRENCY,
      });
    }
    expect([DEFAULT_WORKER_POLL_MS, DEFAULT_WORKER_CONCURRENCY]).toEqual([1_000, 1]);
  });

  it("accepts positive integers, rejects zero / negative / fractions", () => {
    expect(
      minutesWorkerConfigFromEnv({
        MINUTES_WORKER_POLL_MS: "250",
        MINUTES_WORKER_CONCURRENCY: "3",
      }),
    ).toEqual({ pollMs: 250, concurrency: 3 });
    expect(minutesWorkerConfigFromEnv({ MINUTES_WORKER_POLL_MS: "0" }).pollMs).toBe(1_000);
    expect(minutesWorkerConfigFromEnv({ MINUTES_WORKER_CONCURRENCY: "1.5" }).concurrency).toBe(1);
  });

  it("queued claim timeout defaults to 120s and is overridable", () => {
    expect(DEFAULT_QUEUED_CLAIM_TIMEOUT_MS).toBe(120_000);
    expect(queuedClaimTimeoutMsFromEnv({})).toBe(120_000);
    expect(queuedClaimTimeoutMsFromEnv({ MINUTES_QUEUED_CLAIM_TIMEOUT_MS: "5000" })).toBe(5_000);
    expect(queuedClaimTimeoutMsFromEnv({ MINUTES_QUEUED_CLAIM_TIMEOUT_MS: "-1" })).toBe(120_000);
  });
});
