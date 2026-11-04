"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants, Dialog } from "@recap/admin-ui";
import { unlockAudio } from "@/audio/mic-capture";
import type { MeetingDto } from "@/lib/api-types";
import type { InitialRoomData } from "../meeting-room/use-meeting-socket";
import { MobileBanners } from "./mobile-banners";
import { RecordingBar, StartBar } from "./mobile-bottom-bar";
import {
  CONFIRM_STOP_LABEL,
  KEEP_RECORDING_LABEL,
  NEW_MEETING_LABEL,
  OPEN_FULL_TRANSCRIPT_LABEL,
  STOP_CONFIRM_BODY,
  STOP_CONFIRM_TITLE,
} from "./mobile-copy";
import { MobileHeader } from "./mobile-header";
import { MobileMinutes } from "./mobile-minutes";
import { MobileTranscript } from "./mobile-transcript";
import { useMobileRoom } from "./use-mobile-room";

interface MobileRoomProps {
  meeting: MeetingDto;
  initial: InitialRoomData;
  /** The setup tap just created the meeting: start recording on mount. */
  autoStart: boolean;
}

/** The phone recording screen: header, banners, live transcript, bottom bar; minutes once stopped. */
export function MobileRoom({ meeting, initial, autoStart }: MobileRoomProps) {
  const room = useMobileRoom(meeting, initial, autoStart);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const { capture, socket, recording, stopped } = room;

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col bg-bg">
      <MobileHeader
        title={meeting.title}
        status={room.status}
        stopped={stopped && !recording}
        elapsedMs={room.elapsedMs}
        recording={recording}
        levels={capture.levels}
      />
      <MobileBanners
        kinds={room.banners}
        wakeLock={room.wakeLock}
        error={capture.error}
        onResume={() => void room.resume()}
        onRetryConnection={socket.retry}
        onRetryStt={socket.retryStt}
      />
      <MobileTranscript room={socket.room} recording={recording} />
      <BottomArea meeting={meeting} room={room} onAskStop={() => setConfirmingStop(true)} />
      <StopDialog
        open={confirmingStop}
        onOpenChange={setConfirmingStop}
        onConfirm={room.confirmStop}
      />
    </div>
  );
}

interface BottomAreaProps {
  meeting: MeetingDto;
  room: ReturnType<typeof useMobileRoom>;
  onAskStop: () => void;
}

/** Marks + stop while recording; otherwise start / minutes. */
function BottomArea({ meeting, room, onAskStop }: BottomAreaProps) {
  const { socket, capture } = room;
  if (room.recording) {
    return (
      <RecordingBar
        canMark={room.canMark}
        onConclusion={room.markConclusion}
        onTopic={room.markTopic}
        onStop={onAskStop}
      />
    );
  }
  const hasRecording = socket.room.stats.segments > 0 || socket.room.segments.length > 0;
  return (
    <IdleBar
      meetingId={meeting.id}
      sourceLang={meeting.sourceLang}
      stopped={room.stopped}
      hasRecording={hasRecording}
      loading={capture.phase === "requesting"}
      onStart={() => {
        unlockAudio(); // inside the tap, before any await
        void room.start();
      }}
    />
  );
}

interface StopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Stopping is not undoable by accident-tap: ask once. */
function StopDialog({ open, onOpenChange, onConfirm }: StopDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={STOP_CONFIRM_TITLE}
      description={STOP_CONFIRM_BODY}
      footer={
        <>
          <Button variant="ghost" size="lg" onClick={() => onOpenChange(false)}>
            {KEEP_RECORDING_LABEL}
          </Button>
          <Button
            variant="danger"
            size="lg"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {CONFIRM_STOP_LABEL}
          </Button>
        </>
      }
    />
  );
}

interface IdleBarProps {
  meetingId: string;
  sourceLang: string | null;
  stopped: boolean;
  hasRecording: boolean;
  loading: boolean;
  onStart: () => void;
}

/** Not recording: a fresh meeting offers Start; a stopped one offers minutes, Ghi tiếp and links. */
function IdleBar({ meetingId, sourceLang, stopped, hasRecording, loading, onStart }: IdleBarProps) {
  if (!stopped) return <StartBar resuming={hasRecording} loading={loading} onStart={onStart} />;
  return (
    <div className="max-h-[70dvh] shrink-0 overflow-y-auto border-t border-soft-line-strong bg-soft-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <MobileMinutes meetingId={meetingId} sourceLang={sourceLang} />
      <div className="mt-3 flex flex-col gap-2">
        <Button variant="outline" className="h-12 w-full" onClick={onStart} loading={loading}>
          Ghi tiếp
        </Button>
        <Link
          href={`/meetings/${meetingId}`}
          className={buttonVariants({ variant: "ghost", className: "h-12 w-full" })}
        >
          {OPEN_FULL_TRANSCRIPT_LABEL}
        </Link>
        <a href="/m" className={buttonVariants({ variant: "ghost", className: "h-12 w-full" })}>
          {NEW_MEETING_LABEL}
        </a>
      </div>
    </div>
  );
}
