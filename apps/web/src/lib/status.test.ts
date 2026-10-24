import { describe, expect, it } from "vitest";
import {
  MEETING_STATUS,
  PRICING_STATUS,
  PROVIDER_STATUS,
  SERVICE_HEALTH,
  TOPIC_STATUS,
  USER_STATUS,
  MINUTES_SOURCE,
  MINUTES_STALE_STATUS,
  providerState,
} from "./status";

describe("status system", () => {
  it("uses one label per meeting status", () => {
    expect(MEETING_STATUS.ended.label).toBe("Đã kết thúc");
    expect(MEETING_STATUS.draft.label).toBe("Nháp");
    expect(MEETING_STATUS.live.tone).toBe("rec");
  });

  it("reserves amber (conclusion) for decided topics only", () => {
    const withConclusion = [
      ...Object.values(MEETING_STATUS),
      ...Object.values(SERVICE_HEALTH),
      ...Object.values(PROVIDER_STATUS),
      ...Object.values(USER_STATUS),
      ...Object.values(PRICING_STATUS),
      ...Object.values(MINUTES_SOURCE),
      MINUTES_STALE_STATUS,
    ].filter((s) => s.tone === "conclusion");
    expect(withConclusion).toEqual([]);
    expect(TOPIC_STATUS.decided.tone).toBe("conclusion");
    expect(TOPIC_STATUS.open.tone).toBe("neutral");
    expect(TOPIC_STATUS.rejected.tone).toBe("error");
  });

  it("maps provider flags to a state", () => {
    expect(providerState({ configured: true, required: true })).toBe("configured");
    expect(providerState({ configured: false, required: true })).toBe("missing");
    expect(providerState({ configured: false, required: false })).toBe("unused");
  });

  it("never mixes a Vietnamese spelling variant into labels", () => {
    const all = JSON.stringify([USER_STATUS, PROVIDER_STATUS, PRICING_STATUS]);
    expect(all).not.toMatch(/kho\u00e1|Kho\u00e1|hu\u1ef7|Hu\u1ef7|xo\u00e1/);
  });
});
