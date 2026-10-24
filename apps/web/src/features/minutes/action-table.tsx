import { Plus, X } from "@phosphor-icons/react";
import type { ActionItem } from "@recap/core";
import { Button, IconButton } from "@recap/admin-ui";
import { AutoTextarea } from "./auto-textarea";
import type { EditAction } from "./edit-reducer";
import { SectionLabel } from "./section-label";
import { TimestampChip } from "./timestamp-chip";

const COLUMNS = "sm:grid-cols-[minmax(0,1fr)_150px_120px_46px_28px]";
const HEAD = "text-label font-bold uppercase tracking-[0.08em] text-fg-muted";

interface ActionTableProps {
  meetingId: string;
  items: ActionItem[];
  edit: (action: EditAction) => void;
  newId: () => string;
}

export function ActionTable({ meetingId, items, edit, newId }: ActionTableProps) {
  return (
    <section aria-labelledby="actions-heading">
      <SectionLabel id="actions-heading">Việc cần làm</SectionLabel>
      <div className="mt-2 rounded-soft bg-soft-surface shadow-soft-sm">
        {items.length === 0 ? (
          <p className="px-4 py-3 text-small text-fg-muted">Chưa có việc nào được giao.</p>
        ) : (
          <>
            <div aria-hidden className={`hidden gap-x-2 px-3 pt-2 sm:grid ${COLUMNS}`}>
              <span className={`${HEAD} pl-2`}>Việc</span>
              <span className={`${HEAD} pl-2`}>Người phụ trách</span>
              <span className={`${HEAD} pl-2`}>Hạn</span>
            </div>
            <ul>
              {items.map((item, index) => (
                <ActionRow
                  key={item.id}
                  item={item}
                  index={index}
                  meetingId={meetingId}
                  edit={edit}
                />
              ))}
            </ul>
          </>
        )}
        <div className="border-t border-line px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => edit({ type: "action/add", id: newId() })}
          >
            Thêm việc
          </Button>
        </div>
      </div>
    </section>
  );
}

interface ActionRowProps {
  item: ActionItem;
  index: number;
  meetingId: string;
  edit: (action: EditAction) => void;
}

function ActionRow({ item, index, meetingId, edit }: ActionRowProps) {
  const n = index + 1;
  const set = (field: "task" | "owner" | "due") => (value: string) =>
    edit({ type: "action/set", id: item.id, field, value });
  return (
    <li
      className={`grid grid-cols-2 items-start gap-x-2 gap-y-0.5 border-t border-line px-3 py-2 first:border-t-0 ${COLUMNS}`}
    >
      <div className="col-span-2 sm:col-span-1">
        <AutoTextarea
          value={item.task}
          label={`Việc ${n}`}
          placeholder="Việc cần làm"
          onChange={set("task")}
        />
      </div>
      <AutoTextarea
        singleLine
        value={item.owner ?? ""}
        label={`Người phụ trách việc ${n}`}
        placeholder="Người phụ trách"
        onChange={set("owner")}
        className="text-small"
      />
      <AutoTextarea
        singleLine
        value={item.due ?? ""}
        label={`Hạn của việc ${n}`}
        placeholder="Hạn"
        onChange={set("due")}
        className="text-small"
      />
      <div className="col-span-2 flex items-center justify-between sm:contents">
        <span className="sm:pt-[7px]">
          <TimestampChip meetingId={meetingId} atMs={item.atMs} />
        </span>
        <IconButton
          label={`Xóa việc ${n}`}
          size="sm"
          icon={<X size={14} />}
          onClick={() => edit({ type: "action/remove", id: item.id })}
        />
      </div>
    </li>
  );
}
