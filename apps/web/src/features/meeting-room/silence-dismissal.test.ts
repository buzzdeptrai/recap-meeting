import { describe, expect, it } from "vitest";
import { NOT_DISMISSED, rearmSilenceDismissals } from "./silence-dismissal";

const both = { mic: true, tab: true };

describe("rearmSilenceDismissals", () => {
  it("keeps a dismissal while the source stays silent", () => {
    const sources = { tab: "silent", mic: "silent" } as const;
    expect(rearmSilenceDismissals(both, sources, true)).toBe(both);
  });

  it("re-arms a source once it is ok again, so the next silence shows the banner", () => {
    const next = rearmSilenceDismissals(both, { tab: "ok", mic: "silent" }, true);
    expect(next).toEqual({ mic: true, tab: false });
  });

  it("re-arms when the source moves to a real failure state", () => {
    const next = rearmSilenceDismissals(both, { tab: "ended", mic: "lost" }, true);
    expect(next).toEqual(NOT_DISMISSED);
  });

  it("re-arms everything when the recording stops", () => {
    expect(rearmSilenceDismissals(both, { tab: "silent", mic: "silent" }, false)).toEqual(
      NOT_DISMISSED,
    );
  });

  it("returns the same object when nothing changes", () => {
    expect(rearmSilenceDismissals(NOT_DISMISSED, { tab: "ok", mic: "ok" }, true)).toBe(
      NOT_DISMISSED,
    );
  });
});
