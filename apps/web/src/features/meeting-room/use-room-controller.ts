"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MeetingDto } from "@/lib/api-types";
import { isRoomEnded, shouldResume } from "./session-phase";
import { findNewTopicId } from "./topics";
import { useAudioCapture, type AudioCaptureApi } from "./use-audio-capture";
import { useElapsed } from "./use-elapsed";
import { useMarkActions } from "./use-mark-actions";
import { useMarkShortcut } from "./use-mark-shortcut";
import { useLiveStatusRecheck } from "./use-live-status-recheck";
import {
  useMeetingSocket,
  type InitialRoomData,
  type MeetingSocketApi,
} from "./use-meeting-socket";

/** Wires capture + socket + timer + K / T shortcuts; the component only renders. */
export function useRoomController(
  meeting: MeetingDto,
  initial: InitialRoomData,
  onStopped: () => void,
) {
  /** null = follow the loaded status; true after stopping, false after resuming. */
  const [endedOverride, setEndedOverride] = useState<boolean | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const socket = useMeetingSocket({
    meetingId: meeting.id,
    sourceLang: meeting.sourceLang ?? "multi",
    targetLang: meeting.targetLang ?? "vi",
    resume: shouldResume(meeting.status, initial.stats.segments),
    initial,
  });
  const capture = useAudioCapture(socket.sendAudio);
  const recording = capture.phase === "running";
  useLiveStatusRecheck(meeting, endedOverride, recording, setEndedOverride);
  const { clockOrigin, marks } = socket.room;
  const elapsedMs = useElapsed(clockOrigin, recording);
  const canMark = recording && socket.connection === "ready" && clockOrigin !== null;

  const topics = useTopicEditing(marks);
  const { mark, addTopic } = useMarkTriggers({
    clockOrigin,
    canMark,
    sendMark: socket.sendMark,
    beginTopicEdit: topics.begin,
  });
  const { start, confirmStop } = useStartStop(socket, capture, setEndedOverride, onStopped);

  const markActions = useMarkActions(meeting.id, socket, setMarkError);

  return {
    socket,
    capture,
    recording,
    stopped: endedOverride === true,
    ended: isRoomEnded(meeting.status, endedOverride),
    elapsedMs,
    canMark,
    mark,
    addTopic,
    topics,
    markError,
    ...markActions,
    start,
    confirmStop,
  };
}

/**
 * Which topic's name input is open. `begin()` is called right before asking for a new topic; the
 * next topic marker that shows up (the server echo) opens its input.
 */
export function useTopicEditing(marks: Parameters<typeof findNewTopicId>[1]) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const known = useRef<Set<string>>(new Set(marks.map((m) => m.id)));
  const awaiting = useRef(false);

  useEffect(() => {
    const fresh = awaiting.current ? findNewTopicId(known.current, marks) : null;
    known.current = new Set(marks.map((m) => m.id));
    if (!fresh) return;
    awaiting.current = false;
    setEditingId(fresh);
  }, [marks]);

  const begin = useCallback(() => {
    awaiting.current = true;
  }, []);
  const finish = useCallback(() => setEditingId(null), []);
  return { editingId, begin, finish, edit: setEditingId };
}

interface TriggerArgs {
  clockOrigin: number | null;
  canMark: boolean;
  sendMark: (atMs: number, kind?: "conclusion" | "topic") => boolean;
  beginTopicEdit: () => void;
}

/** "Đánh dấu kết luận" (K) and "Chủ đề mới" (T): button callbacks plus keyboard shortcuts. */
function useMarkTriggers({ clockOrigin, canMark, sendMark, beginTopicEdit }: TriggerArgs) {
  const atNow = useCallback(
    () => (clockOrigin === null ? 0 : Date.now() - clockOrigin),
    [clockOrigin],
  );
  const mark = useCallback(() => {
    sendMark(atNow());
  }, [atNow, sendMark]);
  const addTopic = useCallback(() => {
    beginTopicEdit();
    sendMark(atNow(), "topic");
  }, [atNow, sendMark, beginTopicEdit]);
  useMarkShortcut(canMark, mark);
  useMarkShortcut(canMark, addTopic, "t");
  return { mark, addTopic };
}

/** Start (or resume an ended meeting: the room flips back to live once capture is granted) / stop. */
function useStartStop(
  socket: MeetingSocketApi,
  capture: AudioCaptureApi,
  setEndedOverride: (ended: boolean) => void,
  onStopped: () => void,
) {
  const { connect, stop: stopSocket } = socket;
  const { start: startCapture, stop: stopCapture } = capture;
  const start = useCallback(async () => {
    if (!(await startCapture())) return;
    setEndedOverride(false);
    connect();
  }, [startCapture, connect, setEndedOverride]);
  const confirmStop = useCallback(() => {
    stopCapture();
    stopSocket();
    setEndedOverride(true);
    onStopped();
  }, [stopCapture, stopSocket, setEndedOverride, onStopped]);
  return { start, confirmStop };
}
