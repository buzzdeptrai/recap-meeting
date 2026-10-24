import { Plus, X } from "@phosphor-icons/react";
import type { OpenIssue } from "@recap/core";
import { Button, IconButton } from "@recap/admin-ui";
import { AutoTextarea } from "./auto-textarea";
import type { EditAction } from "./edit-reducer";
import { SectionLabel } from "./section-label";

interface IssueListProps {
  issues: OpenIssue[];
  edit: (action: EditAction) => void;
  newId: () => string;
}

export function IssueList({ issues, edit, newId }: IssueListProps) {
  return (
    <section aria-labelledby="issues-heading">
      <SectionLabel id="issues-heading">Vấn đề còn mở</SectionLabel>
      <div className="mt-2 rounded-soft bg-soft-surface shadow-soft-sm">
        {issues.length === 0 ? (
          <p className="px-4 py-3 text-small text-fg-muted">Không có vấn đề nào còn mở.</p>
        ) : (
          <ul>
            {issues.map((issue, index) => (
              <li
                key={issue.id}
                className="grid grid-cols-[minmax(0,1fr)_28px] items-start gap-x-2 border-t border-line px-3 py-2 first:border-t-0"
              >
                <AutoTextarea
                  value={issue.text}
                  label={`Vấn đề ${index + 1}`}
                  placeholder="Vấn đề chưa có lời giải"
                  onChange={(text) => edit({ type: "issue/set", id: issue.id, text })}
                />
                <IconButton
                  label={`Xóa vấn đề ${index + 1}`}
                  size="sm"
                  icon={<X size={14} />}
                  onClick={() => edit({ type: "issue/remove", id: issue.id })}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => edit({ type: "issue/add", id: newId() })}
          >
            Thêm vấn đề
          </Button>
        </div>
      </div>
    </section>
  );
}
