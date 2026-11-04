"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeetingDto } from "@/lib/api-types";
import { MONO_CHANNELS } from "@recap/core";
import { shouldResume } from "../meeting-room/session-phase";
import { useElapsed } from "../meeting-room/use-elapsed";
import { useMarkShortcut } from "../meeting-room/use-mark-shortcut";
import {
  useMeetingSocket,
  type InitialRoomData,
  type MeetingSocketApi,
} from "../meeting-room/use-meeting-socket";
import { recordingStateOf, selectMobileBanners } from "./mobile-logic";
import { useMicCapture, type MicCaptureApi } from "./use-mic-capture";
import { useWakeLock } from "./use-wake-lock";

/**
 * Wires the mic-only capture, the mono socket, the clock, marks and the wake lock for the phone
 * page. The components only render what this returns.
 */
export function useMobileRoom(meeting: MeetingDto, initial: InitialRoomData, autoStart: boolean) {
  const [stopped, setStopped] = useState(meeting.status === "ended");
  const socket = useMeetingSocket({
    meetingId: meeting.id,
    sourceLang: meeting.sourceLang ?? "multi",
    targetLang: meeting.targetLang ?? "vi",
    resume: shouldResume(meeting.status, initial.stats.segments),
    channels: MONO_CHANNELS,
    initial,
  });
  const capture = useMicCapture(socket.sendAudio);
  const recording = capture.phase === "running";
  const wakeLock = useWakeLock(recording);
  const elapsedMs = useElapsed(socket.room.clockOrigin, recording);
  const { start, confirmStop } = useStartStop(socket, capture, setStopped);
  const resume = useResumeCapture(socket, capture);
  useReconnectOnVisible(recording, socket);
  useAutoStart(autoStart, start);

  const canMark = recording && socket.connection === "ready" && socket.room.clockOrigin !== null;
  const marks = useMarkButtons(socket, canMark);

  return {
    socket,
    capture,
    recording,
    stopped,
    elapsedMs,
    wakeLock,
    canMark,
    ...marks,
    status: recordingStateOf(recording, socket.connection),
    banners: selectMobileBanners({
      recording,
      interrupted: capture.interrupted,
      connection: socket.connection,
      stt: socket.room.stt,
    }),
    start,
    confirmStop,
    resume,
  };
}

/** Start: mic first (inside the tap), then the socket. Stop: both, then the meeting is "ended". */
function useStartStop(
  socket: MeetingSocketApi,
  capture: MicCaptureApi,
  setStopped: (stopped: boolean) => void,
) {
  const { connect, stop: stopSocket } = socket;
  const { start: startCapture, stop: stopCapture } = capture;
  const start = useCallback(async () => {
    if (!(await startCapture())) return;
    setStopped(false);
    connect();
  }, [startCapture, connect, setStopped]);
  const confirmStop = useCallback(() => {
    stopCapture();
    stopSocket();
    setStopped(true);
  }, [stopCapture, stopSocket, setStopped]);
  return { start, confirmStop };
}

/**
 * "Tiếp tục" after an interruption: restart the mic, then lean on the existing recovery of the
 * socket (reconnect with resume) and of the speech provider (`stt_retry`).
 */
function useResumeCapture(socket: MeetingSocketApi, capture: MicCaptureApi) {
  const { connection, retry, retryStt, room } = socket;
  const { resume } = capture;
  return useCallback(async () => {
    const ok = await resume();
    if (connection !== "ready") retry();
    else if (room.stt === "closed") retryStt();
    return ok;
  }, [resume, connection, retry, retryStt, room.stt]);
}

/** A phone that was locked drops the socket; reconnect as soon as the page is visible again. */
function useReconnectOnVisible(recording: boolean, socket: MeetingSocketApi) {
  const { connection, retry } = socket;
  useEffect(() => {
    if (!recording) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && connection !== "ready") retry();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [recording, connection, retry]);
}

/** The setup tap already created the meeting; recording begins as soon as the room mounts. */
function useAutoStart(autoStart: boolean, start: () => Promise<void>) {
  useEffect(() => {
    if (autoStart) void start();
    // Only on mount: a later Start is a user tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** K / T buttons: a mark is the time since the meeting clock started, like the desktop room. */
function useMarkButtons(socket: MeetingSocketApi, canMark: boolean) {
  const { clockOrigin } = socket.room;
  const { sendMark } = socket;
  const atNow = useCallback(
    () => (clockOrigin === null ? 0 : Date.now() - clockOrigin),
    [clockOrigin],
  );
  const markConclusion = useCallback(() => void sendMark(atNow()), [atNow, sendMark]);
  const markTopic = useCallback(() => void sendMark(atNow(), "topic"), [atNow, sendMark]);
  useMarkShortcut(canMark, markConclusion);
  useMarkShortcut(canMark, markTopic, "t");
  return { markConclusion, markTopic };
}
