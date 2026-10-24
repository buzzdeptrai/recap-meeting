import { describe, expect, it } from "vitest";
import { CircuitBreaker, DEFAULT_BREAKER_CONFIG } from "../src/circuit-breaker";
import { ManualClock } from "./helpers";

function setup() {
  const clock = new ManualClock();
  return { clock, breaker: new CircuitBreaker(DEFAULT_BREAKER_CONFIG, clock) };
}

describe("CircuitBreaker", () => {
  it("trips after consecutive errors and refuses calls", () => {
    const { breaker } = setup();
    for (let i = 0; i < 3; i++) {
      expect(breaker.acquire("p")).toBe(true);
      breaker.recordFailure("p", "SERVER");
    }
    expect(breaker.state("p")).toBe("open");
    expect(breaker.acquire("p")).toBe(false);
  });

  it("trips on error rate within the window", () => {
    const { breaker } = setup();
    breaker.recordSuccess("p");
    breaker.recordSuccess("p");
    breaker.recordSuccess("p");
    breaker.recordFailure("p", "SERVER");
    expect(breaker.state("p")).toBe("closed");
    breaker.recordSuccess("p");
    breaker.recordFailure("p", "SERVER"); // 2/6 = 33% > 30%
    expect(breaker.state("p")).toBe("open");
  });

  it("allows a single half-open probe after cooldown and recovers on success", () => {
    const { breaker, clock } = setup();
    for (let i = 0; i < 3; i++) breaker.recordFailure("p", "TIMEOUT");
    clock.advance(DEFAULT_BREAKER_CONFIG.cooldownMs);
    expect(breaker.acquire("p")).toBe(true);
    expect(breaker.state("p")).toBe("half-open");
    expect(breaker.acquire("p")).toBe(false); // probe already in flight
    breaker.recordSuccess("p");
    expect(breaker.state("p")).toBe("closed");
    expect(breaker.acquire("p")).toBe(true);
  });

  it("re-opens when the probe fails", () => {
    const { breaker, clock } = setup();
    for (let i = 0; i < 3; i++) breaker.recordFailure("p", "SERVER");
    clock.advance(DEFAULT_BREAKER_CONFIG.cooldownMs);
    breaker.acquire("p");
    breaker.recordFailure("p", "SERVER");
    expect(breaker.state("p")).toBe("open");
    expect(breaker.acquire("p")).toBe(false);
  });

  it("opens immediately with a long cooldown on QUOTA", () => {
    const { breaker, clock } = setup();
    breaker.recordFailure("p", "QUOTA");
    expect(breaker.state("p")).toBe("open");
    clock.advance(DEFAULT_BREAKER_CONFIG.cooldownMs);
    expect(breaker.acquire("p")).toBe(false);
  });

  it("ignores caller aborts but frees the probe slot", () => {
    const { breaker, clock } = setup();
    for (let i = 0; i < 3; i++) breaker.recordFailure("p", "SERVER");
    clock.advance(DEFAULT_BREAKER_CONFIG.cooldownMs);
    breaker.acquire("p");
    breaker.recordFailure("p", "ABORTED");
    expect(breaker.acquire("p")).toBe(true);
  });
});
