import { describe, expect, it } from "vitest";

describe("marker options", () => {
  it("parses topic/conclusion markers and --meeting-id", async () => {
    const { parseOptions } = await import("../src/options");
    const options = parseOptions([
      "--file",
      "a.wav",
      "--meeting-id",
      "m1",
      "--mark-topic-at",
      "20:Giá cả: Q4",
      "--mark-topic-at",
      "5",
      "--mark-conclusion-at",
      "12.5",
    ]);
    expect(options?.meetingId).toBe("m1");
    expect(options?.marks).toEqual([
      { kind: "topic", atSec: 5 },
      { kind: "conclusion", atSec: 12.5 },
      { kind: "topic", atSec: 20, label: "Giá cả: Q4" },
    ]);
  });
});

describe("token option", () => {
  it("defaults to null and accepts an explicit token", async () => {
    const { parseOptions } = await import("../src/options");
    expect(parseOptions(["--file", "a.wav"])?.token).toBeNull();
    expect(parseOptions(["--file", "a.wav", "--token", "abc"])?.token).toBe("abc");
  });
});
