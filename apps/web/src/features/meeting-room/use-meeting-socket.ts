"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import type { Mark, SourceLang, TargetLang } from "@recap/core";
import type { MarkAnchorDto, SegmentsPageDto, TranscriptStatsDto } from "@/lib/api-types";
import { DEFAULT_REALTIME_URL, MeetingSocket, type ConnectionState } from "@/lib/ws-client";
import { initialRoomState, roomReducer, type RoomAction, type RoomState } from "./state";

export interface InitialRoomData {
  /** First page of the transcript (the tail page for a live meeting, or the page around `?t=`). */
  page: SegmentsPageDto;
  marks: Mark[];
  markAnchors: Record<string, MarkAnchorDto>;
  stats: TranscriptStatsDto;
  startedAt: string | null;
}

export interface UseMeetingSocketOptions {
  meetingId: string;
  sourceLang: SourceLang;
  targetLang: TargetLang;
  /** The meeting already has recorded segments (reload of a live meeting). */
  resume: boolean;
  initial: InitialRoomData;
  /** Override for tests / alternate servers. */
  url?: string;
}

export interface MeetingSocketApi {
  room: RoomState;
  /** Reducer dispatch, for the transcript pager (pages loaded over REST). */
  dispatch: Dispatch<RoomAction>;
  connection: ConnectionState;
  /** Opens the socket and sends `start`; frames flow only after `ready`. */
  connect: () => void;
  /** Manual immediate reconnect (the "Thử lại" button). */
  retry: () => void;
  /** Asks the server to restart the speech-to-text provider (the banner's "Thử lại"). */
  retryStt: () => void;
  /** Ends the meeting on the server and closes the socket. */
  stop: () => void;
  /** Returns false when the frame was dropped (not ready / backed up). */
  sendAudio: (frame: ArrayBuffer) => boolean;
  sendMark: (atMs: number, kind?: "conclusion" | "topic") => boolean;
  /** Both return false when the socket is not ready (callers fall back to REST). */
  sendUnmark: (id: string) => boolean;
  sendMarkLabel: (id: string, label: string) => boolean;
  /** Optimistic local edits, applied together with the socket / REST call. */
  applyMarkRemoved: (id: string) => void;
  applyMarkRenamed: (id: string, label: string) => void;
  clearError: () => void;
}

/** A retry that never gets an answer (lost message, stuck provider) is reported as failed. */
export const STT_RETRY_TIMEOUT_MS = 20_000;

function useSttRetry(
  phase: RoomState["sttRetry"],
  connection: ConnectionState,
  dispatch: Dispatch<RoomAction>,
  socketRef: { current: MeetingSocket | null },
): () => void {
  useEffect(() => {
    if (phase !== "waiting" && phase !== "connecting") return;
    const timer = setTimeout(
      () => dispatch({ type: "stt-retry", event: { type: "timeout" } }),
      STT_RETRY_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, dispatch]);
  useEffect(() => {
    if (connection !== "ready") dispatch({ type: "stt-retry", event: { type: "reset" } });
  }, [connection, dispatch]);
  return useCallback(() => {
    dispatch({ type: "stt-retry", event: { type: "click" } });
    if (socketRef.current?.sendSttRetry()) return;
    dispatch({ type: "stt-retry", event: { type: "timeout" } });
  }, [dispatch, socketRef]);
}

function init(initial: InitialRoomData): RoomState {
  return roomReducer(initialRoomState, { type: "hydrate", ...initial });
}

/** Single owner of the realtime connection and the derived room state. */
export function useMeetingSocket(options: UseMeetingSocketOptions): MeetingSocketApi {
  const { meetingId, sourceLang, targetLang, resume, initial, url } = options;
  const [room, dispatch] = useReducer(roomReducer, initial, init);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const socketRef = useRef<MeetingSocket | null>(null);
  /** A session reached `ready` before: any later connect (resume after stop) must resume. */
  const hasRecorded = useRef(false);

  const connect = useCallback(() => {
    socketRef.current?.close();
    const socket = new MeetingSocket({
      url: url ?? process.env.NEXT_PUBLIC_REALTIME_URL ?? DEFAULT_REALTIME_URL,
      meetingId,
      sourceLang,
      targetLang,
      resume: resume || hasRecorded.current,
      onMessage: (message) => {
        if (message.type === "ready") hasRecorded.current = true;
        dispatch({ type: "server", message, receivedAt: Date.now() });
      },
      onConnection: setConnection,
    });
    socketRef.current = socket;
    socket.connect();
  }, [meetingId, sourceLang, targetLang, resume, url]);

  useEffect(() => () => socketRef.current?.close(), []);
  const retryStt = useSttRetry(room.sttRetry, connection, dispatch, socketRef);

  return {
    room,
    dispatch,
    connection,
    connect,
    retry: useCallback(() => socketRef.current?.retry(), []),
    retryStt,
    stop: useCallback(() => socketRef.current?.stop(), []),
    sendAudio: useCallback((frame) => socketRef.current?.sendAudio(frame) ?? false, []),
    sendMark: useCallback((atMs, kind) => socketRef.current?.sendMark(atMs, kind) ?? false, []),
    sendUnmark: useCallback((id) => socketRef.current?.sendUnmark(id) ?? false, []),
    sendMarkLabel: useCallback(
      (id, label) => socketRef.current?.sendMarkLabel(id, label) ?? false,
      [],
    ),
    applyMarkRemoved: useCallback((id) => dispatch({ type: "mark-removed", id }), []),
    applyMarkRenamed: useCallback((id, label) => dispatch({ type: "mark-renamed", id, label }), []),
    clearError: useCallback(() => dispatch({ type: "clear-error" }), []),
  };
}
