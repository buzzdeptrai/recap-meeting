import { Plus, X } from "@phosphor-icons/react";
import type { KeyPoint } from "@recap/core";
import { Button, IconButton } from "@recap/admin-ui";
import { AutoTextarea } from "./auto-textarea";
import { TimestampChip } from "./timestamp-chip";

interface KeyPointsProps {
  meetingId: string;
  points: KeyPoint[];
  onAdd: () => void;
  onChange: (index: number, text: string) => void;
  onRemove: (index: number) => void;
}

export function KeyPoints({ meetingId, points, onAdd, onChange, onRemove }: KeyPointsProps) {
  return (
    <div>
      {points.length > 0 && (
        <ul className="flex flex-col">
          {points.map((point, index) => (
            <li
              // Key points have no stable id; rows are only ever appended or removed by index.
              key={index}
              className="grid grid-cols-[46px_minmax(0,1fr)_28px] items-start gap-x-2 py-0.5"
            >
              <span className="pt-[7px]">
                <TimestampChip meetingId={meetingId} atMs={point.atMs} />
              </span>
              <AutoTextarea
                value={point.text}
                label={`Ý chính ${index + 1}`}
                placeholder="Nội dung ý chính"
                onChange={(text) => onChange(index, text)}
              />
              <IconButton
                label={`Xóa ý chính ${index + 1}`}
                size="sm"
                icon={<X size={14} />}
                onClick={() => onRemove(index)}
              />
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={onAdd} className="mt-1">
        Thêm ý chính
      </Button>
    </div>
  );
}
