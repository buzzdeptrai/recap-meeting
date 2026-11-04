import { describe, expect, it } from "vitest";
import {
  defaultMeetingTitle,
  emptyRoomData,
  recordingStateOf,
  selectMobileBanners,
  wakeLockNeedsManualCare,
  type BannerInput,
} from "./mobile-logic";

describe("defaultMeetingTitle", () => {
  it("formats time then day/month with zero padding", () => {
    expect(defaultMeetingTitle(new Date(2026, 10, 4, 9, 5))).toBe("Cuộc họp 09:05 04/11");
  });
});

describe("emptyRoomData", () => {
  it("has nothing recorded", () => {
    const data = emptyRoomData();
    expect(data.page.segments).toEqual([]);
    expect(data.stats.segments).toBe(0);
    expect(data.startedAt).toBeNull();
  });
});

describe("recordingStateOf", () => {
  it("is idle when not capturing", () => {
    expect(recordingStateOf(false, "ready")).toBe("idle");
  });
  it("is recording only while the socket is ready", () => {
    expect(recordingStateOf(true, "ready")).toBe("recording");
    expect(recordingStateOf(true, "reconnecting")).toBe("reconnecting");
    expect(recordingStateOf(true, "connecting")).toBe("reconnecting");
  });
});

describe("selectMobileBanners", () => {
  const base: BannerInput = {
    recording: true,
    interrupted: false,
    connection: "ready",
    stt: "open",
  };

  it("shows nothing when not recording", () => {
    expect(selectMobileBanners({ ...base, recording: false, interrupted: true })).toEqual([]);
  });

  it("always warns not to lock the phone while recording", () => {
    expect(selectMobileBanners(base)).toEqual(["lock-warning"]);
  });

  it("puts an interruption first", () => {
    expect(selectMobileBanners({ ...base, interrupted: true })).toEqual([
      "interrupted",
      "lock-warning",
    ]);
  });

  it("reports a lost server connection and hides the stt banner behind it", () => {
    expect(selectMobileBanners({ ...base, connection: "reconnecting", stt: "closed" })).toEqual([
      "connection-lost",
      "lock-warning",
    ]);
  });

  it("reports stt trouble while connected", () => {
    expect(selectMobileBanners({ ...base, stt: "closed" })).toEqual(["stt-failed", "lock-warning"]);
    expect(selectMobileBanners({ ...base, stt: "reconnecting" })).toEqual([
      "stt-reconnecting",
      "lock-warning",
    ]);
  });
});

describe("wakeLockNeedsManualCare", () => {
  it("is true when the lock is unsupported or denied", () => {
    expect(wakeLockNeedsManualCare("unsupported")).toBe(true);
    expect(wakeLockNeedsManualCare("denied")).toBe(true);
    expect(wakeLockNeedsManualCare("active")).toBe(false);
    expect(wakeLockNeedsManualCare("idle")).toBe(false);
  });
});
