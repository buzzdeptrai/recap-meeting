"use client";

import { FloatCard, PillTabs, pillTabId, pillTabPanelId } from "@recap/admin-ui";
import { useState, type ReactNode } from "react";
import type { Mark } from "@recap/core";
import type { MarkTarget } from "./marks";
import { ConclusionList, TopicList, type MarkEditing } from "./mark-sections";
import { SessionStats } from "./session-stats";
import { buildSideTabs, SIDE_TABS_ID_BASE, type SideTabId } from "./side-tabs";
import type { RoomState } from "./state";

interface RightRailProps extends MarkEditing {
  room: RoomState;
  onJump: (mark: Mark, target: MarkTarget) => void;
  onJumpTopic: (mark: Mark) => void;
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

/** One floating card: pill tabs (Chủ đề, Kết luận, Phiên, Ghi chú) over their panels. */
export function RightRail({ room, onJump, onJumpTopic, ...editing }: RightRailProps) {
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
        <TopicList marks={room.marks} onJumpTopic={onJumpTopic} {...editing} />
      </Panel>
      <Panel id="conclusions" selected={tab}>
        <ConclusionList
          marks={room.marks}
          segments={room.segments}
          anchors={room.markAnchors}
          onJump={onJump}
          onRemove={editing.onRemove}
        />
      </Panel>
      <Panel id="session" selected={tab}>
        <SessionStats room={room} />
      </Panel>
    </FloatCard>
  );
}
