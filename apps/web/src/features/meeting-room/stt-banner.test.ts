import { describe, expect, it } from "vitest";
import {
  describeSttRetry,
  isSttRetryErrorCode,
  nextSttRetryPhase,
  selectSttBanner,
  type SttRetryPhase,
} from "./stt-banner";

describe("selectSttBanner", () => {
  const base = { recording: true, connection: "ready" as const };

  it("shows nothing while the provider is healthy or unknown", () => {
    expect(selectSttBanner({ ...base, stt: null })).toBeNull();
    expect(selectSttBanner({ ...base, stt: "connecting" })).toBeNull();
    expect(selectSttBanner({ ...base, stt: "open" })).toBeNull();
  });

  it("warns while the provider reconnects and clears once it is open again", () => {
    expect(selectSttBanner({ ...base, stt: "reconnecting" })).toBe("reconnecting");
    expect(selectSttBanner({ ...base, stt: "open" })).toBeNull();
  });

  it("reports a provider that gave up", () => {
    expect(selectSttBanner({ ...base, stt: "closed" })).toBe("failed");
  });

  it("stays quiet when not recording", () => {
    expect(selectSttBanner({ ...base, recording: false, stt: "reconnecting" })).toBeNull();
    expect(selectSttBanner({ ...base, recording: false, stt: "closed" })).toBeNull();
  });

  it("lets the browser-server disconnect banner take precedence", () => {
    expect(
      selectSttBanner({ ...base, connection: "reconnecting", stt: "reconnecting" }),
    ).toBeNull();
    expect(selectSttBanner({ ...base, connection: "reconnecting", stt: "closed" })).toBeNull();
  });
});

describe("nextSttRetryPhase", () => {
  const step = (phase: SttRetryPhase, ...events: Parameters<typeof nextSttRetryPhase>[1][]) =>
    events.reduce(nextSttRetryPhase, phase);

  it("click starts waiting; repeated clicks do not restart", () => {
    expect(step("idle", { type: "click" })).toBe("waiting");
    expect(step("waiting", { type: "click" })).toBe("waiting");
    expect(step("connecting", { type: "click" })).toBe("connecting");
    expect(step("failed", { type: "click" })).toBe("waiting");
  });

  it("a stale closed status before connecting does not count as a failure", () => {
    expect(step("idle", { type: "click" }, { type: "status", stt: "closed" })).toBe("waiting");
  });

  it("connecting then closed means the retry failed", () => {
    expect(
      step(
        "idle",
        { type: "click" },
        { type: "status", stt: "connecting" },
        { type: "status", stt: "closed" },
      ),
    ).toBe("failed");
  });

  it("open or reconnecting ends the attempt successfully", () => {
    expect(step("connecting", { type: "status", stt: "open" })).toBe("idle");
    expect(step("waiting", { type: "status", stt: "open" })).toBe("idle");
    expect(step("waiting", { type: "status", stt: "reconnecting" })).toBe("idle");
  });

  it("ignores status changes when no retry was asked for", () => {
    expect(step("idle", { type: "status", stt: "connecting" })).toBe("idle");
    expect(step("idle", { type: "status", stt: "closed" })).toBe("idle");
  });

  it("maps refusals: already open is fine, other refusals fail", () => {
    expect(step("waiting", { type: "error", code: "STT_ALREADY_OPEN" })).toBe("idle");
    expect(step("waiting", { type: "error", code: "RATE_LIMITED" })).toBe("failed");
    expect(step("waiting", { type: "error", code: "NOT_RECORDING" })).toBe("failed");
    expect(step("waiting", { type: "error", code: "INTERNAL" })).toBe("waiting");
  });

  it("times out to failed, and resets when the browser link drops", () => {
    expect(step("waiting", { type: "timeout" })).toBe("failed");
    expect(step("connecting", { type: "timeout" })).toBe("failed");
    expect(step("idle", { type: "timeout" })).toBe("idle");
    expect(step("connecting", { type: "reset" })).toBe("idle");
  });

  it("recognises the retry error codes", () => {
    expect(isSttRetryErrorCode("RATE_LIMITED")).toBe(true);
    expect(isSttRetryErrorCode("NOT_RECORDING")).toBe(true);
    expect(isSttRetryErrorCode("STT_ALREADY_OPEN")).toBe(true);
    expect(isSttRetryErrorCode("INTERNAL")).toBe(false);
  });
});

describe("describeSttRetry", () => {
  it("is ready to click when idle and connected", () => {
    expect(describeSttRetry("idle", "ready")).toEqual({
      loading: false,
      disabled: false,
      note: null,
    });
  });

  it("shows loading and blocks clicks while a retry is running", () => {
    expect(describeSttRetry("waiting", "ready")).toMatchObject({ loading: true, disabled: true });
    expect(describeSttRetry("connecting", "ready")).toMatchObject({ loading: true });
  });

  it("explains a failed attempt and allows another click", () => {
    expect(describeSttRetry("failed", "ready")).toEqual({
      loading: false,
      disabled: false,
      note: "Chưa kết nối lại được, thử lại sau ít giây.",
    });
  });

  it("disables with a reason when the browser link is not ready", () => {
    expect(describeSttRetry("idle", "connecting")).toMatchObject({
      disabled: true,
      note: "Chưa kết nối máy chủ ghi âm.",
    });
  });
});
