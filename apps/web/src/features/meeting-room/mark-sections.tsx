"use client";

import { ArrowUpRight, BookmarkSimple, Flag, PencilSimple, Trash } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { Mark, Segment } from "@recap/core";
import { IconButton } from "@recap/admin-ui";
import { formatClock } from "@/lib/format";
import { markTarget, type MarkTarget } from "./marks";
import { SectionHeading } from "./suggestion-sections";
import { TopicNameInput } from "./topic-name-input";
import { topicName, topicMarks, conclusionMarks } from "./topics";

export interface MarkEditing {
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}

function PanelEmpty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-small text-fg-muted">
      <span
        aria-hidden
        className="grid size-12 place-items-center rounded-full bg-soft-inset text-soft-faint"
      >
        {icon}
      </span>
      <p>{children}</p>
    </div>
  );
}

const CARD = "rounded-soft-inner bg-soft-inset px-3 py-2.5";

interface TopicListProps extends MarkEditing {
  marks: Mark[];
  onJumpTopic: (mark: Mark) => void;
  /** Show the "Mốc chủ đề" heading (when minutes suggestions follow the list). */
  withHeading?: boolean;
}

/** Hand-made topic markers ("Mốc chủ đề", key T) in the "Chủ đề" tab. */
export function TopicList({ marks, withHeading = false, ...editing }: TopicListProps) {
  const topics = topicMarks(marks);
  if (topics.length === 0) {
    return (
      <PanelEmpty icon={<Flag size={22} />}>
        Chưa có mốc chủ đề nào. Bấm T khi cuộc họp chuyển sang chủ đề mới.
      </PanelEmpty>
    );
  }
  return (
    <>
      {withHeading && <SectionHeading count={topics.length}>Mốc chủ đề</SectionHeading>}
      <ul className="flex flex-col gap-2">
        {topics.map((mark) => (
          <TopicRow key={mark.id} mark={mark} name={topicName(mark, topics)} {...editing} />
        ))}
      </ul>
      <p className="mt-3 px-1 text-[12.5px] text-soft-muted">
        Bấm vào tên để nhảy tới đoạn đó trong bản ghi.
      </p>
    </>
  );
}

function TopicActions(props: {
  id: string;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <span className="flex">
      <IconButton
        size="sm"
        label="Đổi tên chủ đề"
        icon={<PencilSimple size={14} />}
        onClick={() => props.onEdit(props.id)}
      />
      <IconButton
        size="sm"
        label="Xóa chủ đề"
        icon={<Trash size={14} />}
        onClick={() => props.onRemove(props.id)}
      />
    </span>
  );
}

interface TopicRowProps extends MarkEditing {
  mark: Mark;
  name: string;
  onJumpTopic: (mark: Mark) => void;
}

function TopicRow({
  mark,
  name,
  editingId,
  onEdit,
  onRename,
  onRemove,
  onJumpTopic,
}: TopicRowProps) {
  return (
    <li className={`${CARD} grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-2.5`}>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-full bg-soft-surface text-soft-accent-ink"
      >
        <Flag size={14} />
      </span>
      {editingId === mark.id ? (
        <div className="col-span-2">
          <TopicNameInput
            initial={mark.label ?? ""}
            onSave={(label) => {
              onRename(mark.id, label);
              onEdit(null);
            }}
            onSkip={() => onEdit(null)}
          />
        </div>
      ) : (
        <>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onJumpTopic(mark)}
              className="soft-focus block w-full min-w-0 truncate rounded-md text-left text-small font-semibold hover:text-soft-accent-ink"
            >
              {name}
            </button>
            <span className="font-soft-mono text-meta text-fg-muted">{formatClock(mark.atMs)}</span>
          </div>
          <TopicActions id={mark.id} onEdit={onEdit} onRemove={onRemove} />
        </>
      )}
    </li>
  );
}

interface ConclusionListProps {
  marks: Mark[];
  segments: Segment[];
  anchors: Record<string, MarkTarget | undefined>;
  onJump: (mark: Mark, target: MarkTarget) => void;
  onRemove: (id: string) => void;
  /** Show the "Kết luận đã đánh dấu" heading (when minutes suggestions follow the list). */
  withHeading?: boolean;
}

/** Hand-marked conclusions ("Kết luận đã đánh dấu", key K) in the "Kết luận" tab. */
export function ConclusionList({
  marks,
  segments,
  anchors,
  onJump,
  onRemove,
  withHeading = false,
}: ConclusionListProps) {
  const conclusions = conclusionMarks(marks);
  if (conclusions.length === 0) {
    return (
      <PanelEmpty icon={<BookmarkSimple size={22} />}>
        Chưa có kết luận đã đánh dấu nào. Bấm K khi cuộc họp chốt một việc.
      </PanelEmpty>
    );
  }
  return (
    <>
      {withHeading && (
        <SectionHeading count={conclusions.length}>Kết luận đã đánh dấu</SectionHeading>
      )}
      <ul className="flex flex-col gap-2">
        {conclusions.map((mark) => (
          <ConclusionItem
            key={mark.id}
            mark={mark}
            target={markTarget(mark, anchors, segments)}
            onJump={onJump}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </>
  );
}

interface ConclusionItemProps {
  mark: Mark;
  target: MarkTarget | undefined;
  onJump: (mark: Mark, target: MarkTarget) => void;
  onRemove: (id: string) => void;
}

function ConclusionItem({ mark, target, onJump, onRemove }: ConclusionItemProps) {
  return (
    <li className={CARD}>
      <div className="flex items-center gap-2 text-soft-conclusion">
        <BookmarkSimple size={14} aria-hidden />
        <span className="text-[13px] font-semibold">Kết luận đã đánh dấu</span>
        <span className="font-soft-mono text-meta opacity-80">{formatClock(mark.atMs)}</span>
        <IconButton
          size="sm"
          label="Xóa kết luận"
          icon={<Trash size={14} />}
          className="ml-auto text-soft-muted"
          onClick={() => onRemove(mark.id)}
        />
      </div>
      <button
        type="button"
        disabled={!target}
        onClick={() => target && onJump(mark, target)}
        className="soft-focus mt-1 block w-full rounded-md text-left disabled:pointer-events-none"
      >
        <span className="line-clamp-3 block text-small text-soft-ink">{target?.text ?? "—"}</span>
        <span className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-soft-accent-ink">
          <ArrowUpRight size={14} aria-hidden />
          Xem trong bản ghi
        </span>
      </button>
    </li>
  );
}
