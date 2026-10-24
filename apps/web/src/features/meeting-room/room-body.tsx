"use client";

import { FloatCard } from "@recap/admin-ui";
import type { ReactNode, RefObject } from "react";
import type { Mark, TargetLang } from "@recap/core";
import type { Density } from "./density";
import type { MarkTarget } from "./marks";
import type { MinutesSuggestions } from "./minutes-suggestions";
import { MarkBar } from "./mark-bar";
import { RightRail } from "./right-rail";
import type { ViewMode } from "./segment-row";
import { SetupChecklist } from "./setup-checklist";
import { Transcript, type TranscriptHandle } from "./transcript";
import { TranscriptSearch } from "./transcript-search";
import { conclusionRequest, timeRequest, topicRequest } from "./use-transcript-jump";
import type { useRoomController } from "./use-room-controller";
import type { useRoomSearch } from "./use-room-search";

interface RoomBodyProps {
  controller: ReturnType<typeof useRoomController>;
  meetingId: string;
  view: ViewMode;
  density: Density;
  targetLang: TargetLang;
  focusMs: number | null;
  transcript: RefObject<TranscriptHandle | null>;
  search: ReturnType<typeof useRoomSearch>;
  suggestions: MinutesSuggestions;
}

/** Jump callbacks for the side panel (divider from a conclusion, boundary from a topic). */
function useJumps(transcript: RefObject<TranscriptHandle | null>) {
  const jumpToSegment = (mark: Mark, target: MarkTarget) =>
    transcript.current?.jump(conclusionRequest(mark, target));
  const jumpToTopic = (mark: Mark) => transcript.current?.jump(topicRequest(mark));
  const jumpToTime = (atMs: number) => transcript.current?.jump(timeRequest(atMs));
  return { jumpToSegment, jumpToTopic, jumpToTime };
}

function TranscriptCard({
  controller,
  meetingId,
  view,
  density,
  targetLang,
  focusMs,
  transcript,
  search,
}: Omit<RoomBodyProps, "suggestions">) {
  const { socket, recording, ended } = controller;
  const canTestMic = controller.capture.phase === "idle" || controller.capture.phase === "error";
  return (
    <FloatCard
      as="section"
      aria-label="Bản ghi cuộc họp"
      padding="none"
      clip
      className="relative h-[70dvh] min-[1360px]:h-auto min-[1360px]:flex-1"
      bodyClassName="flex min-h-0 flex-col"
    >
      {search.open && (
        <TranscriptSearch api={search.search} inputRef={search.input} onClose={search.close} />
      )}
      <Transcript
        ref={transcript}
        meetingId={meetingId}
        room={socket.room}
        dispatch={socket.dispatch}
        view={view}
        density={density}
        targetLang={targetLang}
        empty={emptyContent({ ended, recording, canTestMic })}
        ended={ended}
        recording={recording}
        focusMs={focusMs}
        searchTerms={search.terms}
      />
      <MarkBar
        canMark={controller.canMark}
        onMark={controller.mark}
        onAddTopic={controller.addTopic}
        markError={controller.markError}
      />
    </FloatCard>
  );
}

/** Transcript card (with the floating mark bar) next to the side card; stacked below 1024px. */
export function RoomBody({
  controller,
  meetingId,
  view,
  density,
  targetLang,
  focusMs,
  transcript,
  search,
  suggestions,
}: RoomBodyProps) {
  const { socket } = controller;
  const { jumpToSegment, jumpToTopic, jumpToTime } = useJumps(transcript);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 min-[1360px]:flex-row">
      <TranscriptCard
        controller={controller}
        meetingId={meetingId}
        view={view}
        density={density}
        targetLang={targetLang}
        focusMs={focusMs}
        transcript={transcript}
        search={search}
      />
      <RightRail
        room={socket.room}
        onJump={jumpToSegment}
        onJumpTopic={jumpToTopic}
        onJumpTime={jumpToTime}
        suggestions={suggestions}
        editingId={controller.topics.editingId}
        onEdit={controller.topics.edit}
        onRename={controller.renameMark}
        onRemove={controller.removeMark}
      />
    </div>
  );
}

interface EmptyContentState {
  ended: boolean;
  recording: boolean;
  /** Capture is idle: the checklist may hold a temporary mic stream for the level test. */
  canTestMic: boolean;
}

function emptyContent({ ended, recording, canTestMic }: EmptyContentState): ReactNode {
  if (ended)
    return <p className="px-6 py-8 text-soft-muted">Cuộc họp này chưa có nội dung nào được ghi.</p>;
  if (recording)
    return <p className="px-6 py-8 text-soft-muted">Đang lắng nghe. Lời nói sẽ hiện ở đây.</p>;
  return <SetupChecklist micTestEnabled={canTestMic} />;
}
