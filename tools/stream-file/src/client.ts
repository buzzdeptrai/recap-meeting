import {
  encodeClientMessage,
  parseServerMessage,
  type ServerMessage,
  type StartMessage,
} from "@recap/core";
import WebSocket from "ws";
import type { MarkClock, StreamMark } from "./options";

const FRAME_MS = 100;
const HTTP_UNAUTHORIZED = 401;
const MS_PER_SECOND = 1_000;
const STOP_WAIT_MS = 15_000;
const READY_WAIT_MS = 10_000;
const BACKPRESSURE_BYTES = 1_000_000;
/** After the last frame, let the STT finish pending audio before "stop" (matters when sped up). */
const TAIL_WAIT_MS = 6_000;

export interface StreamHandlers {
  onMessage(message: ServerMessage): void;
}

/** A marker as sent: `atMs` is what the server received, `audioAtMs` the audio-clock truth. */
export interface SentMark {
  kind: StreamMark["kind"];
  atMs: number;
  audioAtMs: number;
}

export interface StreamResult {
  messages: ServerMessage[];
  sentMarks: SentMark[];
  framesSent: number;
  interrupted: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function waitUnlessInterrupted(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Service token (RECAP_SERVICE_TOKEN) goes in an Authorization header; tools have no login cookie. */
function connect(url: string, token?: string | null): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      url,
      token ? { headers: { authorization: `Bearer ${token}` } } : {},
    );
    socket.once("unexpected-response", (_request, response) => {
      const hint =
        response.statusCode === HTTP_UNAUTHORIZED
          ? " (login required: set RECAP_SERVICE_TOKEN in .env, same value for the realtime server)"
          : "";
      reject(new Error(`Cannot connect to ${url}: HTTP ${response.statusCode}${hint}`));
    });
    socket.once("open", () => resolve(socket));
    socket.once("error", (error) =>
      reject(new Error(`Cannot connect to ${url}: ${error.message}`)),
    );
  });
}

function waitForType(
  messages: ServerMessage[],
  socket: WebSocket,
  type: ServerMessage["type"],
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error(`Timed out waiting for "${type}"`)), timeoutMs);
    const check = () => {
      if (messages.some((m) => m.type === type)) done();
      const fatal = messages.find((m) => m.type === "error" && m.code === "MEETING_NOT_FOUND");
      if (fatal) done(new Error("Server refused the meeting (MEETING_NOT_FOUND)"));
    };
    const done = (error?: Error) => {
      clearTimeout(timer);
      socket.off("message", check);
      socket.off("close", onClose);
      if (error) reject(error);
      else resolve();
    };
    const onClose = () => done(new Error(`Connection closed before "${type}"`));
    socket.on("message", check);
    socket.once("close", onClose);
    check();
  });
}

interface PendingMark {
  kind: StreamMark["kind"];
  /** Offset inside this stream (when to send). */
  streamMs: number;
  /** Position on the meeting timeline (stream offset + audio already recorded). */
  atMs: number;
  label?: string;
}

const toMarkMessage = ({ kind, atMs, label }: PendingMark) =>
  ({ type: "mark", kind, atMs, ...(label ? { label } : {}) }) as const;

/** Picks the `atMs` a marker is sent with (see `--mark-clock`). Pure, so it is unit-tested. */
export function markAtMs(
  clock: MarkClock,
  mark: Pick<PendingMark, "atMs">,
  nowMs: number,
  clockOrigin: number,
): number {
  return clock === "audio" ? mark.atMs : Math.max(0, Math.round(nowMs - clockOrigin));
}

/** Streams frames at `speed`x real time (Infinity = unpaced); stops early when `shouldStop()`. */
async function sendFrames(
  socket: WebSocket,
  frames: readonly Uint8Array[],
  speed: number,
  shouldStop: () => boolean,
  marks: PendingMark[] = [],
  sendMark: (mark: PendingMark) => void = (mark) =>
    socket.send(encodeClientMessage(toMarkMessage(mark))),
): Promise<number> {
  const startedAt = Date.now();
  let sent = 0;
  for (const frame of frames) {
    if (shouldStop() || socket.readyState !== WebSocket.OPEN) break;
    socket.send(frame);
    sent += 1;
    while (marks[0] && marks[0].streamMs <= sent * FRAME_MS) {
      sendMark(marks.shift() as PendingMark);
    }
    if (Number.isFinite(speed)) {
      await sleep(startedAt + (sent * FRAME_MS) / speed - Date.now());
    } else if (socket.bufferedAmount > BACKPRESSURE_BYTES) {
      await sleep(FRAME_MS / 10);
    }
  }
  return sent;
}

export async function streamMeeting(params: {
  url: string;
  /** Optional service token sent as `Authorization: Bearer`. */
  token?: string | null;
  start: StartMessage;
  frames: readonly Uint8Array[];
  speed: number;
  marks?: StreamMark[];
  markClock?: MarkClock;
  handlers: StreamHandlers;
  /** Resolves true when the user asked to stop early (Ctrl+C). */
  interruptSignal: AbortSignal;
}): Promise<StreamResult> {
  const socket = await connect(params.url, params.token);
  const messages: ServerMessage[] = [];
  socket.on("message", (data, isBinary) => {
    if (isBinary) return;
    const parsed = parseServerMessage(data as Buffer);
    if (!parsed.ok) return;
    messages.push(parsed.message);
    params.handlers.onMessage(parsed.message);
  });
  socket.send(encodeClientMessage(params.start));
  await waitForType(messages, socket, "ready", READY_WAIT_MS);
  const readyAt = Date.now();
  const baseMs = messages.find((m) => m.type === "ready")?.baseMs ?? 0;
  const clockOrigin = readyAt - baseMs; // the browser's `clockOrigin`
  const sentMarks: SentMark[] = [];
  const marks = (params.marks ?? []).map((m) => {
    const streamMs = Math.round(m.atSec * MS_PER_SECOND);
    return { kind: m.kind, streamMs, atMs: baseMs + streamMs, label: m.label };
  });
  const framesSent = await sendFrames(
    socket,
    params.frames,
    params.speed,
    () => params.interruptSignal.aborted,
    marks,
    (mark) => {
      const atMs = markAtMs(params.markClock ?? "audio", mark, Date.now(), clockOrigin);
      sentMarks.push({ kind: mark.kind, atMs, audioAtMs: mark.atMs });
      socket.send(encodeClientMessage(toMarkMessage({ ...mark, atMs })));
    },
  );
  await waitUnlessInterrupted(TAIL_WAIT_MS, params.interruptSignal);
  socket.send(encodeClientMessage({ type: "stop" }));
  await waitForType(messages, socket, "stopped", STOP_WAIT_MS).catch(() => undefined);
  socket.close();
  return { messages, sentMarks, framesSent, interrupted: params.interruptSignal.aborted };
}

export const framesToSeconds = (frames: number) => (frames * FRAME_MS) / MS_PER_SECOND;
