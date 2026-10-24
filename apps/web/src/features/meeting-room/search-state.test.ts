import { describe, expect, it } from "vitest";
import type { TranscriptHitDto } from "@/lib/api-types";
import { initialSearchState, searchReducer, stepIndex, type SearchState } from "./search-state";

const hit = (seq: number): TranscriptHitDto => ({
  segmentId: `s${seq}`,
  seq,
  startMs: seq * 1000,
  snippet: "<mark>a</mark>",
  source: "text",
});
const result = (seqs: number[], truncated = false) => ({
  hits: seqs.map(hit),
  truncated,
  terms: ["a"],
});

const ready = (seqs: number[], active = 0): SearchState => ({
  ...initialSearchState,
  query: "a",
  status: "ready",
  hits: seqs.map(hit),
  terms: ["a"],
  active,
});

describe("stepIndex", () => {
  it("wraps in both directions and starts at the ends", () => {
    expect(stepIndex(0, 3, 1)).toBe(1);
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
    expect(stepIndex(-1, 3, 1)).toBe(0);
    expect(stepIndex(-1, 3, -1)).toBe(2);
    expect(stepIndex(-1, 0, 1)).toBe(-1);
  });
});

describe("searchReducer", () => {
  it("goes loading on a query and resets on a blank one", () => {
    const loading = searchReducer(initialSearchState, { type: "query", query: "giá" });
    expect(loading).toMatchObject({ query: "giá", status: "loading" });
    expect(searchReducer(ready([1, 2]), { type: "query", query: "  " })).toEqual({
      ...initialSearchState,
      query: "  ",
    });
  });

  it("selects the first hit when results arrive and ignores results of an old query", () => {
    const loading = searchReducer(initialSearchState, { type: "query", query: "a" });
    const done = searchReducer(loading, { type: "results", query: "a", result: result([4, 9]) });
    expect(done).toMatchObject({ status: "ready", active: 0, terms: ["a"] });
    expect(searchReducer(loading, { type: "results", query: "old", result: result([1]) })).toBe(
      loading,
    );
  });

  it("keeps the current hit across a refresh when it is still there", () => {
    const refreshed = searchReducer(ready([4, 9], 1), {
      type: "results",
      query: "a",
      result: result([4, 9, 12]),
    });
    expect(refreshed.active).toBe(1);
    const gone = searchReducer(ready([4, 9], 1), {
      type: "results",
      query: "a",
      result: result([12]),
    });
    expect(gone.active).toBe(0);
    const none = searchReducer(ready([4], 0), { type: "results", query: "a", result: result([]) });
    expect(none).toMatchObject({ status: "ready", active: -1, hits: [] });
  });

  it("steps through hits with wrap-around and collapses the list on select", () => {
    let state = ready([1, 2, 3], 2);
    state = searchReducer(state, { type: "step", delta: 1 });
    expect(state.active).toBe(0);
    state = searchReducer(state, { type: "step", delta: -1 });
    expect(state.active).toBe(2);
    expect(state.listOpen).toBe(false);
    state = searchReducer(state, { type: "select", index: 1 });
    expect(state).toMatchObject({ active: 1, listOpen: false });
    expect(searchReducer(state, { type: "toggle-list" }).listOpen).toBe(true);
  });

  it("asks the transcript to scroll only when the current hit changed or was chosen", () => {
    const first = searchReducer(searchReducer(initialSearchState, { type: "query", query: "a" }), {
      type: "results",
      query: "a",
      result: result([4, 9]),
    });
    expect(first.nonce).toBe(1);
    const refreshed = searchReducer(first, {
      type: "results",
      query: "a",
      result: result([4, 9, 12]),
    });
    expect(refreshed.nonce).toBe(1);
    expect(searchReducer(refreshed, { type: "step", delta: 1 }).nonce).toBe(2);
    expect(searchReducer(refreshed, { type: "select", index: 0 }).nonce).toBe(2);
  });

  it("records failures for the current query only", () => {
    const loading = searchReducer(initialSearchState, { type: "query", query: "a" });
    expect(searchReducer(loading, { type: "failed", query: "a" }).status).toBe("error");
    expect(searchReducer(loading, { type: "failed", query: "zzz" })).toBe(loading);
    expect(searchReducer(ready([1]), { type: "reset" })).toEqual(initialSearchState);
  });
});
