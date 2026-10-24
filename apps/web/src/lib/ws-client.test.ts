import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FRAME_BYTES } from "@recap/core";
import { MeetingSocket, type ConnectionState, type SocketLike } from "./ws-client";

class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  readyState = 0;
  bufferedAmount = 0;
  binaryType = "blob";
  onopen: SocketLike["onopen"] = null;
  onmessage: SocketLike["onmessage"] = null;
  onclose: SocketLike["onclose"] = null;
  onerror: SocketLike["onerror"] = null;
  sent: Array<string | ArrayBufferLike> = [];
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string | ArrayBufferLike) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.({});
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(message: unknown) {
    this.onmessage?.({ data: typeof message === "string" ? message : JSON.stringify(message) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({});
  }
  json() {
    return this.sent.filter((s): s is string => typeof s === "string").map((s) => JSON.parse(s));
  }
}

const READY = { type: "ready", meetingId: "m1", startedAt: "2026-10-21T10:00:00.000Z" };
const latest = () => FakeSocket.instances[FakeSocket.instances.length - 1]!;

function setup(resume = false) {
  const messages: unknown[] = [];
  const states: ConnectionState[] = [];
  const invalid: string[] = [];
  const socket = new MeetingSocket({
    url: "ws://test/ws",
    meetingId: "m1",
    sourceLang: "multi",
    targetLang: "vi",
    resume,
    onMessage: (m) => messages.push(m),
    onConnection: (s) => states.push(s),
    onInvalid: (r) => invalid.push(r),
    createSocket: (url) => new FakeSocket(url),
    backoffMs: (attempt) => 100 * (attempt + 1),
  });
  return { socket, messages, states, invalid };
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("MeetingSocket", () => {
  it("sends start on open and only streams audio after ready", () => {
    const { socket, states } = setup();
    socket.connect();
    latest().open();
    expect(latest().json()).toEqual([
      { type: "start", meetingId: "m1", sourceLang: "multi", targetLang: "vi" },
    ]);
    const frame = new ArrayBuffer(FRAME_BYTES);
    expect(socket.sendAudio(frame)).toBe(false);
    latest().receive(READY);
    expect(socket.sendAudio(frame)).toBe(true);
    expect(latest().sent.at(-1)).toBe(frame);
    expect(states).toEqual(["connecting", "ready"]);
  });

  it("validates incoming messages and reports invalid ones", () => {
    const { socket, messages, invalid } = setup();
    socket.connect();
    latest().open();
    latest().receive({ type: "segment", segment: { id: "s" } });
    latest().receive("not json");
    latest().receive({ type: "pong", t: 1 });
    latest().receive({
      type: "status",
      stt: "open",
      translate: { provider: "gemini", degraded: false },
    });
    expect(invalid).toHaveLength(2);
    expect(messages).toEqual([
      { type: "status", stt: "open", translate: { provider: "gemini", degraded: false } },
    ]);
  });

  it("reconnects with backoff and resumes the meeting", () => {
    const { socket, states } = setup();
    socket.connect();
    latest().open();
    latest().receive(READY);
    latest().drop();
    expect(states.at(-1)).toBe("reconnecting");
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(FakeSocket.instances).toHaveLength(2);
    latest().drop();
    vi.advanceTimersByTime(150);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(50);
    expect(FakeSocket.instances).toHaveLength(3);
    latest().open();
    expect(latest().json()[0]).toMatchObject({ type: "start", resume: true });
    latest().receive(READY);
    expect(states.at(-1)).toBe("ready");
  });

  it("retry() reconnects immediately", () => {
    const { socket } = setup();
    socket.connect();
    latest().drop();
    socket.retry();
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("stop() sends stop and closes on stopped without reconnecting", () => {
    const { socket, states } = setup();
    socket.connect();
    latest().open();
    latest().receive(READY);
    socket.stop();
    expect(latest().json().at(-1)).toEqual({ type: "stop" });
    latest().receive({ type: "stopped", meetingId: "m1" });
    expect(states.at(-1)).toBe("closed");
    vi.advanceTimersByTime(20_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("sends marks and drops audio when the socket is backed up", () => {
    const { socket } = setup();
    socket.connect();
    latest().open();
    latest().receive(READY);
    expect(socket.sendMark(1234.6)).toBe(true);
    expect(latest().json().at(-1)).toEqual({ type: "mark", kind: "conclusion", atMs: 1235 });
    latest().bufferedAmount = 5_000_000;
    expect(socket.sendAudio(new ArrayBuffer(FRAME_BYTES))).toBe(false);
  });

  it("sends topic marks, unmark and mark_label", () => {
    const { socket } = setup();
    socket.connect();
    latest().open();
    latest().receive(READY);
    expect(socket.sendMark(500, "topic")).toBe(true);
    expect(socket.sendUnmark("k1")).toBe(true);
    expect(socket.sendMarkLabel("k1", "Ngân sách")).toBe(true);
    expect(latest().json().slice(-3)).toEqual([
      { type: "mark", kind: "topic", atMs: 500 },
      { type: "unmark", id: "k1" },
      { type: "mark_label", id: "k1", label: "Ngân sách" },
    ]);
  });

  it("sends stt_retry only while the socket is open", () => {
    const { socket } = setup();
    expect(socket.sendSttRetry()).toBe(false);
    socket.connect();
    latest().open();
    latest().receive(READY);
    expect(socket.sendSttRetry()).toBe(true);
    expect(latest().json().at(-1)).toEqual({ type: "stt_retry" });
  });

  it("reports false for mark edits while not connected", () => {
    const { socket } = setup();
    expect(socket.sendUnmark("k1")).toBe(false);
    expect(socket.sendMarkLabel("k1", "x")).toBe(false);
  });

  it("pings periodically while ready", () => {
    const { socket } = setup();
    socket.connect();
    latest().open();
    latest().receive(READY);
    vi.advanceTimersByTime(15_000);
    expect(
      latest()
        .json()
        .some((m) => m.type === "ping"),
    ).toBe(true);
  });
});
