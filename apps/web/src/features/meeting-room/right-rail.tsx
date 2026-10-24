"use client";

import { BookmarkSimple, Flag } from "@phosphor-icons/react";
import { Button, Kbd } from "@recap/admin-ui";
import { formatSeconds } from "@/lib/format";
import type { Mark } from "@recap/core";
import type { MarkTarget } from "./marks";
import { ConclusionList, SECTION_LABEL, TopicList, type MarkEditing } from "./mark-sections";
import { averageLatencyMs, type RoomState } from "./state";

const LABEL = SECTION_LABEL;
const MARK_HINT_ID = "mark-disabled-hint";

interface RightRailProps extends MarkEditing {
  room: RoomState;
  canMark: boolean;
  onMark: () => void;
  onAddTopic: () => void;
  onJump: (target: MarkTarget) => void;
  onJumpTopic: (mark: Mark) => void;
  markError: string | null;
}

export function RightRail({
  room,
  canMark,
  onMark,
  onAddTopic,
  onJump,
  onJumpTopic,
  markError,
  ...editing
}: RightRailProps) {
  return (
    <aside
      aria-label="Chủ đề, kết luận và thông tin phiên"
      className="flex flex-col gap-6 border-t border-line bg-surface p-4 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l"
    >
      <MarkButtons canMark={canMark} onMark={onMark} onAddTopic={onAddTopic} />
      {markError && (
        <p role="alert" className="text-[13px] text-err">
          {markError}
        </p>
      )}
      <TopicList marks={room.marks} onJumpTopic={onJumpTopic} {...editing} />
      <ConclusionList
        marks={room.marks}
        segments={room.segments}
        anchors={room.markAnchors}
        onJump={onJump}
        onRemove={editing.onRemove}
      />
      <SessionStats room={room} />
    </aside>
  );
}

interface MarkButtonsProps {
  canMark: boolean;
  onMark: () => void;
  onAddTopic: () => void;
}

function MarkButtons({ canMark, onMark, onAddTopic }: MarkButtonsProps) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        onClick={onAddTopic}
        disabled={!canMark}
        aria-describedby={canMark ? undefined : MARK_HINT_ID}
        className="w-full justify-between"
      >
        <span className="inline-flex items-center gap-2">
          <Flag size={16} className="text-accent" />
          Chủ đề mới
        </span>
        <Kbd>T</Kbd>
      </Button>
      <Button
        variant="outline"
        onClick={onMark}
        disabled={!canMark}
        aria-describedby={canMark ? undefined : MARK_HINT_ID}
        className="w-full justify-between"
      >
        <span className="inline-flex items-center gap-2">
          <BookmarkSimple size={16} className="text-decision" />
          Đánh dấu kết luận
        </span>
        <Kbd>K</Kbd>
      </Button>
      {!canMark && (
        <p id={MARK_HINT_ID} className="text-xs text-soft-muted">
          Chỉ đánh dấu được khi đang ghi. Bấm Bắt đầu ghi hoặc Ghi tiếp trước.
        </p>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-[13px] text-fg-muted">{label}</dt>
      <dd className="font-soft-mono text-[13px]">{value}</dd>
    </div>
  );
}

function SessionStats({ room }: { room: RoomState }) {
  const latency = averageLatencyMs(room.latencies);
  const { stats } = room;
  return (
    <section aria-labelledby="session-heading">
      <h2 id="session-heading" className={LABEL}>
        Phiên
      </h2>
      <dl className="mt-1 divide-y divide-line">
        <StatRow label="Độ trễ dịch" value={latency === null ? "—" : formatSeconds(latency)} />
        <StatRow label="Số đoạn" value={String(stats.segments)} />
        <StatRow label="Số từ" value={String(stats.words)} />
        <StatRow label="Đã dịch" value={`${stats.translated}/${stats.segments}`} />
      </dl>
    </section>
  );
}
