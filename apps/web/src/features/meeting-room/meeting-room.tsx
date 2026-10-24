"use client";

import { ArrowClockwise, FileText, Info, Record, Stop } from "@phosphor-icons/react";
import Link from "next/link";
import { useRef, useState, type ReactNode, type RefObject } from "react";
import type { Mark } from "@recap/core";
import type { MeetingDto } from "@/lib/api-types";
import { ActionGroup, Banner, Button, buttonVariants, ConfirmDialog } from "@recap/admin-ui";
import type { MarkTarget } from "./marks";
import { RESUME_HINT, roomActions } from "./session-phase";
import { RightRail } from "./right-rail";
import { RoomBanners } from "./room-banners";
import { RoomTopBar, type RecState } from "./room-top-bar";
import type { ViewMode } from "./segment-row";
import { SetupChecklist } from "./setup-checklist";
import { SourceStrip } from "./source-strip";
import { Transcript, type TranscriptHandle } from "./transcript";
import { TranscriptSearch } from "./transcript-search";
import { topicRequest } from "./use-transcript-jump";
import { useRoomSearch } from "./use-room-search";
import { useRoomController } from "./use-room-controller";
import type { InitialRoomData } from "./use-meeting-socket";

interface MeetingRoomProps {
  meeting: MeetingDto;
  initial: InitialRoomData;
  /** Offset (ms) to scroll to and highlight, from a minutes timestamp link. */
  focusMs?: number | null;
}

export function MeetingRoom({ meeting, initial, focusMs = null }: MeetingRoomProps) {
  const [view, setView] = useState<ViewMode>("both");
  const [stopOpen, setStopOpen] = useState(false);
  const controller = useRoomController(meeting, initial, () => setStopOpen(false));
  const { socket, capture, recording, ended } = controller;
  const root = useRef<HTMLDivElement>(null);
  const transcript = useRef<TranscriptHandle>(null);
  const search = useRoomSearch({ meetingId: meeting.id, room: socket.room, root, transcript });

  return (
    <div ref={root} className="flex min-h-dvh flex-col lg:h-dvh">
      <RoomHeader
        meeting={meeting}
        controller={controller}
        view={view}
        onViewChange={setView}
        search={search}
        onStop={() => setStopOpen(true)}
      />
      {ended && !recording && <ResumeHint />}
      <RoomBanners
        phase={capture.phase}
        sources={capture.sources}
        captureError={capture.error}
        connection={socket.connection}
        stt={socket.room.stt}
        serverError={socket.room.lastError}
        onReshare={capture.reshareTab}
        onRetry={socket.retry}
        onDismissError={socket.clearError}
      />
      <SourceStrip
        active={recording}
        sources={capture.sources}
        levels={capture.levels}
        room={socket.room}
      />
      <RoomBody
        controller={controller}
        meetingId={meeting.id}
        view={view}
        focusMs={focusMs}
        transcript={transcript}
        search={search}
      />
      <StopDialog open={stopOpen} onOpenChange={setStopOpen} onConfirm={controller.confirmStop} />
    </div>
  );
}

interface RoomHeaderProps {
  meeting: MeetingDto;
  controller: ReturnType<typeof useRoomController>;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  search: ReturnType<typeof useRoomSearch>;
  onStop: () => void;
}

function RoomHeader({ meeting, controller, view, onViewChange, search, onStop }: RoomHeaderProps) {
  const { socket, capture, recording, ended } = controller;
  return (
    <RoomTopBar
      meetingId={meeting.id}
      title={meeting.title}
      rec={recState(ended, socket.connection)}
      elapsedMs={controller.elapsedMs}
      durationMs={controller.stopped ? controller.elapsedMs : meeting.durationMs}
      view={view}
      onViewChange={onViewChange}
      onSearch={search.open ? search.close : search.openSearch}
      searchOpen={search.open}
      action={
        <RoomAction
          ended={ended}
          meetingId={meeting.id}
          recording={recording}
          requesting={capture.phase === "requesting"}
          onStart={controller.start}
          onStop={onStop}
        />
      }
    />
  );
}

interface RoomBodyProps {
  controller: ReturnType<typeof useRoomController>;
  meetingId: string;
  view: ViewMode;
  focusMs: number | null;
  transcript: RefObject<TranscriptHandle | null>;
  search: ReturnType<typeof useRoomSearch>;
}

function RoomBody({ controller, meetingId, view, focusMs, transcript, search }: RoomBodyProps) {
  const { socket, recording, ended } = controller;
  const empty = emptyContent({ ended, recording });
  const jumpToSegment = (target: MarkTarget) =>
    transcript.current?.jump({
      kind: "segment",
      id: target.id,
      seq: target.seq,
      atMs: target.startMs,
    });
  const jumpToTopic = (mark: Mark) => transcript.current?.jump(topicRequest(mark));
  return (
    <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex h-[70dvh] min-h-0 flex-col lg:h-auto lg:flex-1">
        {search.open && (
          <TranscriptSearch api={search.search} inputRef={search.input} onClose={search.close} />
        )}
        <Transcript
          ref={transcript}
          meetingId={meetingId}
          room={socket.room}
          dispatch={socket.dispatch}
          view={view}
          empty={empty}
          ended={ended}
          recording={recording}
          focusMs={focusMs}
          searchTerms={search.terms}
        />
      </div>
      <RightRail
        room={socket.room}
        canMark={controller.canMark}
        onMark={controller.mark}
        onAddTopic={controller.addTopic}
        onJump={jumpToSegment}
        onJumpTopic={jumpToTopic}
        markError={controller.markError}
        editingId={controller.topics.editingId}
        onEdit={controller.topics.edit}
        onRename={controller.renameMark}
        onRemove={controller.removeMark}
      />
    </main>
  );
}

function recState(ended: boolean, connection: string): RecState {
  if (ended) return "ended";
  if (connection === "ready") return "recording";
  return connection === "reconnecting" ? "reconnecting" : "idle";
}

interface RoomActionProps {
  ended: boolean;
  meetingId: string;
  recording: boolean;
  requesting: boolean;
  onStart: () => void;
  onStop: () => void;
}

function RoomAction({ ended, meetingId, recording, requesting, onStart, onStop }: RoomActionProps) {
  const actions = roomActions(ended, recording);
  if (actions.minutes) {
    return (
      <ActionGroup>
        <Link
          href={`/meetings/${meetingId}/minutes`}
          className={buttonVariants({ variant: "outline" })}
        >
          <FileText size={16} />
          Biên bản
        </Link>
        <Button onClick={onStart} loading={requesting} icon={<ArrowClockwise size={16} />}>
          Ghi tiếp
        </Button>
      </ActionGroup>
    );
  }
  if (actions.stop) {
    return (
      <Button variant="danger" onClick={onStop} icon={<Stop size={16} weight="fill" />}>
        Dừng ghi
      </Button>
    );
  }
  return (
    <Button onClick={onStart} loading={requesting} icon={<Record size={16} />}>
      Bắt đầu ghi
    </Button>
  );
}

interface EmptyArgs {
  ended: boolean;
  recording: boolean;
}

function emptyContent({ ended, recording }: EmptyArgs): ReactNode {
  if (ended)
    return <p className="px-6 py-8 text-soft-muted">Cuộc họp này chưa có nội dung nào được ghi.</p>;
  if (recording)
    return <p className="px-6 py-8 text-soft-muted">Đang lắng nghe. Lời nói sẽ hiện ở đây.</p>;
  return <SetupChecklist />;
}

interface StopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function StopDialog({ open, onOpenChange, onConfirm }: StopDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Dừng ghi cuộc họp?"
      description="Phiên ghi sẽ kết thúc. Bản ghi và bản dịch đã có vẫn được giữ lại."
      confirmLabel="Dừng ghi"
      cancelLabel="Tiếp tục ghi"
      destructive
      onConfirm={onConfirm}
    />
  );
}

function ResumeHint() {
  return (
    <Banner tone="info" layout="bar" icon={<Info />}>
      {RESUME_HINT}
    </Banner>
  );
}
