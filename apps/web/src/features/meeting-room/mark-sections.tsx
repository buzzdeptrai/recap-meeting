"use client";

import { PencilSimple, Trash } from "@phosphor-icons/react";
import type { Mark, Segment } from "@recap/core";
import { IconButton } from "@recap/admin-ui";
import { formatClock } from "@/lib/format";
import { markTarget, type MarkTarget } from "./marks";
import { TopicNameInput } from "./topic-name-input";
import { topicName, topicMarks, conclusionMarks } from "./topics";

export const SECTION_LABEL = "text-label font-bold uppercase tracking-[0.08em] text-fg-muted";

export interface MarkEditing {
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}

interface TopicListProps extends MarkEditing {
  marks: Mark[];
  onJumpTopic: (mark: Mark) => void;
}

export function TopicList({ marks, ...editing }: TopicListProps) {
  const topics = topicMarks(marks);
  return (
    <section aria-labelledby="topics-heading">
      <h2 id="topics-heading" className={SECTION_LABEL}>
        Chủ đề
      </h2>
      {topics.length === 0 ? (
        <p className="mt-2 text-small text-fg-muted">
          Chưa có chủ đề nào. Bấm T khi cuộc họp chuyển sang chủ đề mới.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {topics.map((mark) => (
            <TopicRow key={mark.id} mark={mark} name={topicName(mark, topics)} {...editing} />
          ))}
        </ul>
      )}
    </section>
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
    <li className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-x-2 border-t border-line py-1.5 first:border-t-0">
      <span className="font-mono text-meta text-accent">{formatClock(mark.atMs)}</span>
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
          <button
            type="button"
            onClick={() => onJumpTopic(mark)}
            className="min-w-0 truncate rounded-control py-1 text-left text-small font-medium hover:bg-surface-2"
          >
            {name}
          </button>
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
  onJump: (target: MarkTarget) => void;
  onRemove: (id: string) => void;
}

export function ConclusionList({
  marks,
  segments,
  anchors,
  onJump,
  onRemove,
}: ConclusionListProps) {
  const conclusions = conclusionMarks(marks);
  return (
    <section aria-labelledby="marks-heading">
      <h2 id="marks-heading" className={SECTION_LABEL}>
        Kết luận đã đánh dấu
      </h2>
      {conclusions.length === 0 ? (
        <p className="mt-2 text-small text-fg-muted">
          Chưa có kết luận nào. Bấm K khi cuộc họp chốt một việc.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col">
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
      )}
    </section>
  );
}

interface ConclusionItemProps {
  mark: Mark;
  target: MarkTarget | undefined;
  onJump: (target: MarkTarget) => void;
  onRemove: (id: string) => void;
}

function ConclusionItem({ mark, target, onJump, onRemove }: ConclusionItemProps) {
  return (
    <li className="flex items-start border-t border-line first:border-t-0">
      <button
        type="button"
        disabled={!target}
        onClick={() => target && onJump(target)}
        className="grid min-w-0 flex-1 grid-cols-[64px_minmax(0,1fr)] gap-x-2 rounded-control py-2 text-left transition-colors duration-[120ms] hover:bg-surface-2 disabled:pointer-events-none"
      >
        <span className="pt-px font-mono text-meta text-decision">{formatClock(mark.atMs)}</span>
        <span className="line-clamp-2 text-small text-fg-muted">{target?.text ?? "—"}</span>
      </button>
      <IconButton
        size="sm"
        label="Xóa kết luận"
        icon={<Trash size={14} />}
        className="mt-1.5"
        onClick={() => onRemove(mark.id)}
      />
    </li>
  );
}
