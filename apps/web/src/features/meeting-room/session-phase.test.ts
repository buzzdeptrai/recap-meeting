import { describe, expect, it } from "vitest";
import { isRoomEnded, roomActions, shouldResume } from "./session-phase";

describe("isRoomEnded", () => {
  it("follows the loaded status until the page acts", () => {
    expect(isRoomEnded("ended", null)).toBe(true);
    expect(isRoomEnded("live", null)).toBe(false);
  });

  it("resume flips an ended meeting back to live without reload, stop ends it again", () => {
    expect(isRoomEnded("ended", false)).toBe(false);
    expect(isRoomEnded("ended", true)).toBe(true);
    expect(isRoomEnded("draft", true)).toBe(true);
  });
});

describe("shouldResume", () => {
  it("resumes anything already recorded", () => {
    expect(shouldResume("draft", 0)).toBe(false);
    expect(shouldResume("draft", 3)).toBe(true);
    expect(shouldResume("ended", 0)).toBe(true);
    expect(shouldResume("live", 0)).toBe(true);
  });
});

describe("roomActions", () => {
  it("ended shows Biên bản + Ghi tiếp, never the start/stop buttons", () => {
    expect(roomActions(true, false)).toEqual({
      minutes: true,
      resume: true,
      start: false,
      stop: false,
    });
  });

  it("recording hides the minutes button", () => {
    expect(roomActions(false, true)).toEqual({
      minutes: false,
      resume: false,
      start: false,
      stop: true,
    });
    expect(roomActions(true, true).minutes).toBe(false);
  });
});
