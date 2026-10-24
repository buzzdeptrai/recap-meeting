import type { Segment, ServerMessage } from "@recap/core";
import { describe, expect, it } from "vitest";
import { segmentAtMark } from "./marks";
import { averageLatencyMs, initialRoomState, roomReducer, type RoomState } from "./state";

const seg = (seq: number, overrides: Partial<Segment> = {}): Segment => ({
  id: `s${seq}`,
  seq,
  channel: 1,
  lang: "en",
  startMs: seq * 1000,
  endMs: seq * 1000 + 800,
  text: `text ${seq}`,
  ...overrides,
});

const apply = (state: RoomState, message: ServerMessage) =>
  roomReducer(state, { type: "server", message });

const translation = (segmentId: string, text = "xin chào"): ServerMessage => ({
  type: "translation",
  segmentId,
  seq: 0,
  lang: "vi",
  text,
  provider: "gemini",
  latencyMs: 900,
});

describe("roomReducer", () => {
  it("keeps segments ordered by seq even when they arrive out of order", () => {
    let state = initialRoomState;
    for (const seq of [2, 0, 1]) state = apply(state, { type: "segment", segment: seg(seq) });
    expect(state.segments.map((s) => s.seq)).toEqual([0, 1, 2]);
  });

  it("dedupes a re-sent segment (same id or same seq)", () => {
    let state = apply(initialRoomState, { type: "segment", segment: seg(1) });
    state = apply(state, { type: "segment", segment: seg(1, { text: "edited" }) });
    state = apply(state, { type: "segment", segment: seg(1, { id: "other" }) });
    expect(state.segments).toHaveLength(1);
  });

  it("stores a translation that arrives before its segment", () => {
    let state = apply(initialRoomState, translation("s0"));
    expect(state.segments).toHaveLength(0);
    state = apply(state, { type: "segment", segment: seg(0) });
    expect(state.translations["s0"]?.text).toBe("xin chào");
  });

  it("overwrites a translation that arrives again", () => {
    let state = apply(initialRoomState, translation("s0", "một"));
    state = apply(state, translation("s0", "hai"));
    expect(state.translations["s0"]?.text).toBe("hai");
    expect(state.latencies).toEqual([900, 900]);
  });

  it("clears the channel interim when its segment is final", () => {
    let state = apply(initialRoomState, {
      type: "interim",
      channel: 1,
      text: "we can",
      startMs: 0,
      endMs: 500,
    });
    state = apply(state, { type: "interim", channel: 0, text: "yes", startMs: 0, endMs: 300 });
    expect(state.interim[1]?.text).toBe("we can");
    state = apply(state, { type: "segment", segment: seg(0, { channel: 1 }) });
    expect(state.interim[1]).toBeNull();
    expect(state.interim[0]?.text).toBe("yes");
  });

  it("dedupes marks by id and sorts by time", () => {
    let state = apply(initialRoomState, {
      type: "mark",
      mark: { id: "b", kind: "conclusion", atMs: 5000, label: null },
    });
    state = apply(state, {
      type: "mark",
      mark: { id: "a", kind: "conclusion", atMs: 1000, label: null },
    });
    state = apply(state, {
      type: "mark",
      mark: { id: "b", kind: "conclusion", atMs: 5000, label: null },
    });
    expect(state.marks.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("tracks status, ready and errors", () => {
    let state = apply(initialRoomState, {
      type: "status",
      stt: "open",
      translate: { provider: "gemini", degraded: false },
    });
    expect(state.stt).toBe("open");
    state = apply(state, { type: "ready", meetingId: "m", startedAt: "2026-10-21T10:00:00.000Z" });
    expect(state.startedAt).toBe("2026-10-21T10:00:00.000Z");
    state = apply(state, { type: "error", code: "STT_UNAVAILABLE", message: "x" });
    expect(state.lastError?.code).toBe("STT_UNAVAILABLE");
    expect(roomReducer(state, { type: "clear-error" }).lastError).toBeNull();
  });

  it("drives the STT retry phase from clicks, status and refusals without a generic error", () => {
    const status = (stt: "connecting" | "open" | "closed") =>
      ({ type: "status", stt, translate: { provider: null, degraded: false } }) as const;
    let state = roomReducer(initialRoomState, { type: "stt-retry", event: { type: "click" } });
    expect(state.sttRetry).toBe("waiting");
    state = apply(state, status("connecting"));
    state = apply(state, status("closed"));
    expect(state.sttRetry).toBe("failed");
    state = roomReducer(state, { type: "stt-retry", event: { type: "click" } });
    state = apply(state, { type: "error", code: "RATE_LIMITED", message: "x" });
    expect(state.sttRetry).toBe("failed");
    expect(state.lastError).toBeNull();
    state = roomReducer(state, { type: "stt-retry", event: { type: "click" } });
    state = apply(state, status("open"));
    expect(state.sttRetry).toBe("idle");
  });

  it("hydrates from the REST detail, deduped and ordered", () => {
    const state = roomReducer(initialRoomState, {
      type: "hydrate",
      page: {
        segments: [seg(1), seg(0)],
        translations: [{ segmentId: "s0", lang: "vi", text: "a", provider: "p", latencyMs: 1 }],
        nextCursor: 2,
        prevCursor: null,
        total: 5,
      },
      marks: [{ id: "m", kind: "conclusion", atMs: 10, label: null }],
      markAnchors: {},
      stats: { segments: 5, words: 10, translated: 1 },
      startedAt: null,
    });
    expect(state.segments.map((s) => s.seq)).toEqual([0, 1]);
    expect(state.translations["s0"]?.text).toBe("a");
    expect(state.marks).toHaveLength(1);
    expect(state.window).toEqual({ prevCursor: null, nextCursor: 2 });
    expect(state.stats.segments).toBe(5);
  });
});

const page = (seqs: number[], nextCursor: number | null, prevCursor: number | null) => ({
  segments: seqs.map((n) => seg(n)),
  translations: seqs.map((n) => ({
    segmentId: `s${n}`,
    lang: "vi" as const,
    text: `d${n}`,
    provider: "p",
    latencyMs: 1,
  })),
  nextCursor,
  prevCursor,
  total: 20,
});

const windowed: RoomState = {
  ...initialRoomState,
  segments: [seg(5), seg(6)],
  window: { prevCursor: 5, nextCursor: 7 },
  stats: { segments: 20, words: 0, translated: 0 },
};

describe("paged window", () => {
  it("appends a forward page for the awaited cursor and moves nextCursor", () => {
    const state = roomReducer(windowed, {
      type: "page-loaded",
      dir: "forward",
      from: 7,
      page: page([7, 8], 9, 7),
    });
    expect(state.segments.map((s) => s.seq)).toEqual([5, 6, 7, 8]);
    expect(state.window).toEqual({ prevCursor: 5, nextCursor: 9 });
    expect(state.translations["s8"]?.text).toBe("d8");
  });

  it("prepends a backward page and reaches the head", () => {
    const state = roomReducer(windowed, {
      type: "page-loaded",
      dir: "backward",
      from: 5,
      page: page([3, 4], 5, null),
    });
    expect(state.segments.map((s) => s.seq)).toEqual([3, 4, 5, 6]);
    expect(state.window).toEqual({ prevCursor: null, nextCursor: 7 });
  });

  it("ignores a stale page whose cursor is no longer awaited", () => {
    const replaced = roomReducer(windowed, {
      type: "window-replaced",
      page: page([10, 11], 12, 10),
    });
    const stale = roomReducer(replaced, {
      type: "page-loaded",
      dir: "forward",
      from: 7,
      page: page([7, 8], 9, 7),
    });
    expect(stale).toBe(replaced);
    expect(replaced.segments.map((s) => s.seq)).toEqual([10, 11]);
    expect(Object.keys(replaced.translations)).toEqual(["s10", "s11"]);
  });

  it("holds a live segment back while the window is not the tail, then merges it", () => {
    const state = apply(windowed, { type: "segment", segment: seg(99, { text: "one two three" }) });
    expect(state.segments.map((s) => s.seq)).toEqual([5, 6]);
    expect(state.pendingLive.map((s) => s.seq)).toEqual([99]);
    const tail = roomReducer(state, { type: "window-replaced", page: page([97, 98], null, 97) });
    expect(tail.segments.map((s) => s.seq)).toEqual([97, 98, 99]);
    expect(tail.pendingLive).toEqual([]);
    const notTail = roomReducer(state, { type: "window-replaced", page: page([10], 11, 10) });
    expect(notTail.pendingLive).toHaveLength(1);
    expect(state.stats).toMatchObject({ segments: 21, words: 3 });
    expect(state.liveFromSeq).toBe(99);
  });

  it("appends and counts live segments at the tail, counting a re-sent one once", () => {
    const tail: RoomState = { ...windowed, window: { prevCursor: 5, nextCursor: null } };
    let state = apply(tail, { type: "segment", segment: seg(7) });
    state = apply(state, { type: "segment", segment: seg(7, { text: "edited" }) });
    expect(state.segments.map((s) => s.seq)).toEqual([5, 6, 7]);
    expect(state.stats.segments).toBe(21);
    state = apply(state, translation("s7"));
    state = apply(state, translation("s7", "again"));
    expect(state.stats.translated).toBe(1);
  });
});

describe("marks: unmark, rename and timeline origin", () => {
  const topic = (id: string, atMs: number, label: string | null = null) => ({
    id,
    kind: "topic" as const,
    atMs,
    label,
  });

  it("upserts a renamed mark (same id) and removes on unmark", () => {
    let state = apply(initialRoomState, { type: "mark", mark: topic("t", 1000) });
    state = apply(state, { type: "mark", mark: topic("t", 1000, "Giá") });
    expect(state.marks).toEqual([topic("t", 1000, "Giá")]);
    state = apply(state, { type: "unmark", id: "t" });
    expect(state.marks).toEqual([]);
  });

  it("applies optimistic local rename / removal idempotently", () => {
    let state = apply(initialRoomState, { type: "mark", mark: topic("t", 1000) });
    state = roomReducer(state, { type: "mark-renamed", id: "t", label: "  Mới " });
    expect(state.marks[0]?.label).toBe("Mới");
    state = roomReducer(state, { type: "mark-renamed", id: "t", label: " " });
    expect(state.marks[0]?.label).toBeNull();
    state = roomReducer(state, { type: "mark-removed", id: "t" });
    state = roomReducer(state, { type: "mark-removed", id: "t" });
    expect(state.marks).toEqual([]);
  });

  it("anchors the timeline at ready time minus recorded audio (resume)", () => {
    const ready = (baseMs?: number): ServerMessage => ({
      type: "ready",
      meetingId: "m",
      startedAt: "2026-10-21T10:00:00.000Z",
      ...(baseMs === undefined ? {} : { baseMs }),
    });
    const fresh = roomReducer(initialRoomState, {
      type: "server",
      message: ready(),
      receivedAt: 5_000,
    });
    expect(fresh.clockOrigin).toBe(5_000);
    const resumed = roomReducer(initialRoomState, {
      type: "server",
      message: ready(120_000),
      receivedAt: 500_000,
    });
    expect(resumed.clockOrigin).toBe(380_000);
  });
});

describe("helpers", () => {
  it("averages latency", () => {
    expect(averageLatencyMs([])).toBeNull();
    expect(averageLatencyMs([800, 1000])).toBe(900);
  });
});

describe("segmentAtMark", () => {
  it("prefers the spanning segment, else the last one before the mark", () => {
    const list = [seg(0), seg(1), seg(5)];
    expect(segmentAtMark(list, { atMs: 1200 })?.id).toBe("s1");
    expect(segmentAtMark(list, { atMs: 3000 })?.id).toBe("s1");
    expect(segmentAtMark(list, { atMs: 0 })?.id).toBe("s0");
    expect(segmentAtMark([seg(5)], { atMs: 100 })).toBeUndefined();
  });
});
