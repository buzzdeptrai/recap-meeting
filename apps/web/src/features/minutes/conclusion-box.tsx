import { BookmarkSimple, Plus, X } from "@phosphor-icons/react";
import type { Conclusion } from "@recap/core";
import { Button, IconButton } from "@recap/admin-ui";
import { AutoTextarea } from "./auto-textarea";
import { TimestampChip } from "./timestamp-chip";

interface ConclusionBoxProps {
  meetingId: string;
  topicTitle: string;
  conclusion: Conclusion | null;
  onAdd: () => void;
  onChange: (text: string) => void;
  onRemove: () => void;
}

/** The one warm block on the page: what the meeting settled. */
export function ConclusionBox({
  meetingId,
  topicTitle,
  conclusion,
  onAdd,
  onChange,
  onRemove,
}: ConclusionBoxProps) {
  if (!conclusion) {
    return (
      <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={onAdd}>
        Thêm kết luận
      </Button>
    );
  }
  const name = topicTitle.trim() || "chủ đề này";
  return (
    <div className="rounded-control border-l-2 border-decision bg-decision-bg py-2 pr-2 pl-3">
      <div className="flex items-center gap-2">
        <span className="text-label font-bold uppercase tracking-[0.08em] text-decision">
          Kết luận
        </span>
        {conclusion.marked && (
          <span className="inline-flex items-center gap-1 text-meta text-decision">
            <BookmarkSimple size={14} weight="fill" aria-hidden />
            Đã đánh dấu trong cuộc họp
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <TimestampChip meetingId={meetingId} atMs={conclusion.atMs} />
          <IconButton
            label={`Xóa kết luận của ${name}`}
            size="sm"
            icon={<X size={14} />}
            onClick={onRemove}
          />
        </span>
      </div>
      <AutoTextarea
        value={conclusion.text}
        label={`Kết luận của ${name}`}
        placeholder="Cuộc họp đã chốt điều gì"
        onChange={onChange}
        className="mt-1 font-medium hover:border-decision/40 focus:bg-decision-bg"
      />
    </div>
  );
}
