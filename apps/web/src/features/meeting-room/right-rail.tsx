"use client";

import { FloatCard, PillTabs, pillTabId, pillTabPanelId } from "@recap/admin-ui";
import { useState, type ReactNode } from "react";
import type { Mark } from "@recap/core";
import type { MarkTarget } from "./marks";
import { ConclusionList, TopicList, type MarkEditing } from "./mark-sections";
import { visibleSuggestions, type MinutesSuggestions } from "./minutes-suggestions";
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
  const shown = visibleSuggestions(suggestions, room.marks).topics;
  return (
    <>
      <TopicList marks={room.marks} withHeading={shown.length > 0} {...rest} />
      <TopicSuggestions items={shown} onJump={onJump} />
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
  const shown = visibleSuggestions(suggestions, room.marks).conclusions;
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
      <ConclusionSuggestions items={shown} onJump={onJumpTime} />
    </>
  );
}

/** One floating card: pill tabs (Chủ đề, Kết luận, Phiên, Ghi chú) over their panels. */
export function RightRail({
  room,
  onJump,
  onJumpTopic,
  onJumpTime,
  suggestions,
  ...editing
}: RightRailProps) {
  const [tab, setTab] = useState<SideTabId>("topics");
  return (
    <FloatCard
      as="aside"
      aria-label="Chủ đề, kết luận và thông tin phiên"
      padding="sm"
      className="min-[1360px]:w-[380px] min-[1360px]:shrink-0"
      bodyClassName="overflow-y-auto px-2 pb-2 pt-3 min-[1360px]:px-3"
      header={
        <PillTabs
          ariaLabel="Thông tin cuộc họp"
          idBase={SIDE_TABS_ID_BASE}
          tabs={buildSideTabs(room.marks)}
          value={tab}
          onValueChange={(id) => setTab(id as SideTabId)}
        />
      }
    >
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
    </FloatCard>
  );
}
