import { describe, expect, it } from "vitest";
import { noteOffset, settledState, sortNotes } from "./notes-state";

describe("sortNotes", () => {
  it("orders timed notes by offset and keeps untimed ones last, stable", () => {
    const items = [
      { id: "u1", atMs: null },
      { id: "b", atMs: 9_000 },
      { id: "a", atMs: 1_000 },
      { id: "a2", atMs: 1_000 },
      { id: "u2", atMs: null },
    ];
    expect(sortNotes(items).map((n) => n.id)).toEqual(["a", "a2", "b", "u1", "u2"]);
  });

  it("does not mutate its input", () => {
    const items = [{ atMs: 2 }, { atMs: 1 }];
    sortNotes(items);
    expect(items[0]?.atMs).toBe(2);
  });
});

describe("noteOffset", () => {
  it("stamps meeting time only while recording with a clock", () => {
    expect(noteOffset(1_000, true, 6_000)).toBe(5_000);
    expect(noteOffset(1_000, false, 6_000)).toBeNull();
    expect(noteOffset(null, true, 6_000)).toBeNull();
  });

  it("never goes negative", () => {
    expect(noteOffset(10_000, true, 9_000)).toBe(0);
  });
});

describe("settledState", () => {
  it("shows saving while calls are in flight, then error or saved", () => {
    expect(settledState(2, true)).toBe("saving");
    expect(settledState(0, true)).toBe("error");
    expect(settledState(0, false)).toBe("saved");
  });
});
