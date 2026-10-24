import { Plus } from "@phosphor-icons/react";
import type { MinutesContent, MinutesTopic } from "@recap/core";
import { Button } from "@recap/admin-ui";
import { ActionTable } from "./action-table";
import { AutoTextarea } from "./auto-textarea";
import type { EditAction } from "./edit-reducer";
import { IssueList } from "./issue-list";
import { SectionLabel } from "./section-label";
import { TopicCard } from "./topic-card";

interface MinutesEditorProps {
  meetingId: string;
  content: MinutesContent;
  edit: (action: EditAction) => void;
  onRemoveTopic: (topic: MinutesTopic) => void;
}

const newId = () => crypto.randomUUID();

export function MinutesEditor({ meetingId, content, edit, onRemoveTopic }: MinutesEditorProps) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="summary-heading">
        <SectionLabel id="summary-heading">Tóm tắt</SectionLabel>
        <div className="mt-2 rounded-soft border border-soft-line-strong bg-soft-surface shadow-soft-sm p-2">
          <AutoTextarea
            value={content.summary}
            label="Tóm tắt cuộc họp"
            placeholder="Tóm tắt nội dung chính của cuộc họp"
            onChange={(text) => edit({ type: "summary/set", text })}
            className="text-transcript"
          />
        </div>
      </section>
      <section aria-labelledby="topics-heading">
        <SectionLabel id="topics-heading">Chủ đề thảo luận</SectionLabel>
        <div className="mt-2 flex flex-col gap-3">
          {content.topics.map((topic, index) => (
            <TopicCard
              key={topic.id}
              meetingId={meetingId}
              topic={topic}
              index={index}
              count={content.topics.length}
              edit={edit}
              onRemove={onRemoveTopic}
            />
          ))}
          <div>
            <Button
              variant="outline"
              icon={<Plus size={16} />}
              onClick={() => edit({ type: "topic/add", id: newId() })}
            >
              Thêm chủ đề
            </Button>
          </div>
        </div>
      </section>
      <ActionTable meetingId={meetingId} items={content.actionItems} edit={edit} newId={newId} />
      <IssueList issues={content.openIssues} edit={edit} newId={newId} />
    </div>
  );
}
