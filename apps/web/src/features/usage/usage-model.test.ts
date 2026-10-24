import { describe, expect, it } from "vitest";
import { budgetView, deltaFromPct, keyColor, keyLabel, serviceHealth } from "./usage-model";

describe("serviceHealth", () => {
  it("is green below 2% errors", () => {
    expect(serviceHealth(100, 0).status).toBe("ok");
    expect(serviceHealth(100, 0.0199).status).toBe("ok");
  });

  it("is amber from 2% to 5%", () => {
    expect(serviceHealth(100, 0.02).status).toBe("warn");
    expect(serviceHealth(100, 0.05).status).toBe("warn");
  });

  it("is red above 5%", () => {
    expect(serviceHealth(100, 0.0501).status).toBe("bad");
    expect(serviceHealth(10, 1).status).toBe("bad");
  });

  it("is grey, never green, with no data", () => {
    expect(serviceHealth(0, 0)).toEqual({ status: "idle", label: "Chưa có dữ liệu" });
    expect(serviceHealth(5, Number.NaN).status).toBe("idle");
  });
});

describe("deltaFromPct", () => {
  it("formats signed vi-VN percentages", () => {
    expect(deltaFromPct(18.84)).toEqual({ text: "+18,8%", direction: "up" });
    expect(deltaFromPct(-4)).toEqual({ text: "-4%", direction: "down" });
    expect(deltaFromPct(0)).toEqual({ text: "0%", direction: "flat" });
  });

  it("has nothing to show without a baseline", () => {
    expect(deltaFromPct(null)).toBeNull();
    expect(deltaFromPct(undefined)).toBeNull();
  });
});

describe("budgetView", () => {
  const input = {
    monthlyUsd: 60,
    month: "2026-10",
    spentUsd: 41.87,
    projectedUsd: 59,
    percentUsed: 69.8,
    daysElapsed: 21.5,
    daysInMonth: 31,
  };

  it("derives remaining, average, days left and the 80% threshold", () => {
    const view = budgetView(input);
    expect(view.remainingUsd).toBeCloseTo(18.13, 2);
    expect(view.avgPerDayUsd).toBeCloseTo(1.947, 2);
    expect(view.daysLeft).toBe(9);
    expect(view.alertUsd).toBeCloseTo(48);
    expect(view.overAlert).toBe(false);
    expect(view.monthLabel).toBe("tháng 10/2026");
  });

  it("flags crossing the alert threshold and never goes negative", () => {
    const view = budgetView({ ...input, spentUsd: 70, percentUsed: 116 });
    expect(view.overAlert).toBe(true);
    expect(view.remainingUsd).toBe(0);
  });
});

describe("labels", () => {
  it("names vendors, services and unassigned meetings", () => {
    expect(keyLabel("vendor", "openai")).toBe("OpenAI");
    expect(keyLabel("service", "stt_live")).toBe("Chép lời trực tiếp");
    expect(keyLabel("model", "gpt-4.1")).toBe("gpt-4.1");
    expect(keyLabel("meeting", null)).toBe("Không gắn cuộc họp");
  });

  it("gives vendors fixed colours and cycles a palette otherwise", () => {
    expect(keyColor("vendor", "deepgram", 3)).toBe("#1D4ED8");
    expect(keyColor("model", "a", 0)).toBe(keyColor("model", "b", 5));
  });
});
