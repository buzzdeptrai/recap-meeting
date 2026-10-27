"use client";

import { FloatCard, PillTabs, pillTabId, pillTabPanelId } from "@recap/admin-ui";
import { useState, type ReactNode } from "react";
import type { Mark } from "@recap/core";
import type { MarkTarget } from "./marks";
import { NotesPanel } from "./notes-panel";
import type { MeetingNotesApi } from "./use-meeting-notes";
import { ConclusionList, TopicList, type MarkEditing } from "./mark-sections";
import { hiddenCounts, visibleSuggestions, type MinutesSuggestions } from "./minutes-suggestions";
import { SessionStats } from "./session-stats";
import { buildSideTabs, SIDE_TABS_ID_BASE, type SideTabId } from "./side-tabs";
import type { RoomState } from "./state";
import { ConclusionSuggestions, TopicSuggestions } from "./suggestion-sections";

interface RightRailProps extends MarkEditing {
  room: RoomState;
  onJump: (mark: Mark, target: MarkTarget) => void;
  onJumpTopic: (mark: Mark) => void;
  onJumpTime: (atMs: number) => void;
  suggestions: MinutesSuggestions;
  /** Hand notes of the meeting ("Ghi chú" tab). */
  notes: MeetingNotesApi;
  getNoteOffset: () => number | null;
  recording: boolean;
}

function Panel({
  id,
  selected,
  children,
}: {
  id: SideTabId;
  selected: SideTabId;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={pillTabPanelId(SIDE_TABS_ID_BASE, id)}
      aria-labelledby={pillTabId(SIDE_TABS_ID_BASE, id)}
      hidden={id !== selected}
    >
      {children}
    </div>
  );
}

type TopicsBodyProps = MarkEditing & {
  room: RoomState;
  suggestions: MinutesSuggestions;
  onJump: (atMs: number) => void;
  onJumpTopic: (mark: Mark) => void;
};

/** Hand-made topic markers, then the topics proposed by the minutes. */
function TopicsBody({ room, suggestions, onJump, ...rest }: TopicsBodyProps) {
  const visible = visibleSuggestions(suggestions, room.marks);
  const shown = visible.topics;
  return (
    <>
      <TopicList marks={room.marks} withHeading={shown.length > 0} {...rest} />
      <TopicSuggestions
        items={shown}
        hidden={hiddenCounts(suggestions, visible).topics}
        onJump={onJump}
      />
    </>
  );
}

interface ConclusionsBodyProps {
  room: RoomState;
  suggestions: MinutesSuggestions;
  onJump: (mark: Mark, target: MarkTarget) => void;
  onJumpTime: (atMs: number) => void;
  onRemove: (id: string) => void;
}

/** Hand-marked conclusions, then the conclusions the AI proposed in the minutes. */
function ConclusionsBody({
  room,
  suggestions,
  onJump,
  onJumpTime,
  onRemove,
}: ConclusionsBodyProps) {
  const visible = visibleSuggestions(suggestions, room.marks);
  const shown = visible.conclusions;
  return (
    <>
      <ConclusionList
        marks={room.marks}
        segments={room.segments}
        anchors={room.markAnchors}
        onJump={onJump}
        onRemove={onRemove}
        withHeading={shown.length > 0}
      />
      <ConclusionSuggestions
        items={shown}
        hidden={hiddenCounts(suggestions, visible).conclusions}
        onJump={onJumpTime}
      />
    </>
  );
}

type RailPanelsProps = MarkEditing &
  Omit<RightRailProps, "notes" | "getNoteOffset"> & {
    tab: SideTabId;
    notes: MeetingNotesApi;
    getNoteOffset: () => number | null;
  };

function RailPanels({
  tab,
  room,
  onJump,
  onJumpTopic,
  onJumpTime,
  suggestions,
  notes,
  getNoteOffset,
  recording,
  ...editing
}: RailPanelsProps) {
  return (
    <>
      <Panel id="topics" selected={tab}>
        <TopicsBody
          room={room}
          suggestions={suggestions}
          {...{ onJumpTopic, ...editing }}
          onJump={onJumpTime}
        />
      </Panel>
      <Panel id="conclusions" selected={tab}>
        <ConclusionsBody
          room={room}
          suggestions={suggestions}
          onJump={onJump}
          onJumpTime={onJumpTime}
          onRemove={editing.onRemove}
        />
      </Panel>
      <Panel id="session" selected={tab}>
        <SessionStats room={room} />
      </Panel>
      <Panel id="notes" selected={tab}>
        <NotesPanel
          notes={notes}
          getOffset={getNoteOffset}
          recording={recording}
          onJumpTime={onJumpTime}
        />
      </Panel>
    </>
  );
}

/** One floating card: pill tabs (Chủ đề, Kết luận, Phiên, Ghi chú) over their panels. */
export function RightRail(props: RightRailProps) {
  const [tab, setTab] = useState<SideTabId>("topics");
  return (
    <FloatCard
      as="aside"
      aria-label="Chủ đề, kết luận, thông tin phiên và ghi chú"
      padding="sm"
      className="min-[1360px]:w-[380px] min-[1360px]:shrink-0"
      bodyClassName="overflow-y-auto px-2 pb-2 pt-3 min-[1360px]:px-3"
      header={
        <PillTabs
          ariaLabel="Thông tin cuộc họp"
          idBase={SIDE_TABS_ID_BASE}
          tabs={buildSideTabs(props.room.marks, props.notes.notes.length)}
          value={tab}
          onValueChange={(id) => setTab(id as SideTabId)}
        />
      }
    >
      <RailPanels tab={tab} {...props} />
    </FloatCard>
  );
}
