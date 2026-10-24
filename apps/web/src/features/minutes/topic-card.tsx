import { ArrowDown, ArrowUp, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import type { MinutesTopic, TopicStatus } from "@recap/core";
import { IconButton, SegmentedControl, type SegmentOption } from "@recap/admin-ui";
import { TOPIC_STATUS } from "@/lib/status";
import { AutoTextarea } from "./auto-textarea";
import { ConclusionBox } from "./conclusion-box";
import type { EditAction } from "./edit-reducer";
import { KeyPoints } from "./key-points";

const STATUS_ORDER: ReadonlyArray<TopicStatus> = ["decided", "open", "rejected"];
const STATUS_OPTIONS: ReadonlyArray<SegmentOption<TopicStatus>> = STATUS_ORDER.map((value) => ({
  value,
  label: TOPIC_STATUS[value].label,
}));

interface TopicCardProps {
  meetingId: string;
  topic: MinutesTopic;
  index: number;
  count: number;
  edit: (action: EditAction) => void;
  onRemove: (topic: MinutesTopic) => void;
}

export function TopicCard(props: TopicCardProps) {
  const { meetingId, topic, index, edit } = props;
  const id = topic.id;
  const name = topic.title.trim() || `chủ đề ${index + 1}`;
  return (
    <article
      aria-label={`Chủ đề ${index + 1}`}
      className={clsx(
        "rounded-soft border border-l-[3px] border-soft-line-strong bg-soft-surface p-4 shadow-soft-sm",
        topic.status === "decided" ? "border-l-decision" : "border-l-transparent",
      )}
    >
      <TopicHeader {...props} />
      <div className="mt-2 px-2">
        <SegmentedControl
          variant="tabs"
          ariaLabel={`Trạng thái của ${name}`}
          size="sm"
          options={STATUS_OPTIONS}
          value={topic.status}
          onValueChange={(status) => edit({ type: "topic/status", id, status })}
        />
      </div>
      <div className="mt-3">
        <KeyPoints
          meetingId={meetingId}
          points={topic.keyPoints}
          onAdd={() => edit({ type: "keyPoint/add", topicId: id })}
          onChange={(i, text) => edit({ type: "keyPoint/set", topicId: id, index: i, text })}
          onRemove={(i) => edit({ type: "keyPoint/remove", topicId: id, index: i })}
        />
      </div>
      <div className="mt-2">
        <ConclusionBox
          meetingId={meetingId}
          topicTitle={topic.title}
          conclusion={topic.conclusion}
          onAdd={() => edit({ type: "conclusion/add", topicId: id })}
          onChange={(text) => edit({ type: "conclusion/set", topicId: id, text })}
          onRemove={() => edit({ type: "conclusion/remove", topicId: id })}
        />
      </div>
    </article>
  );
}

function TopicHeader({ topic, index, count, edit, onRemove }: TopicCardProps) {
  const id = topic.id;
  const name = topic.title.trim() || `chủ đề ${index + 1}`;
  return (
    <div className="flex items-start gap-2">
      <AutoTextarea
        singleLine
        value={topic.title}
        label={`Tiêu đề chủ đề ${index + 1}`}
        placeholder="Tiêu đề chủ đề"
        maxLength={500}
        onChange={(title) => edit({ type: "topic/title", id, title })}
        className="text-[16px] font-semibold"
      />
      <div className="flex shrink-0 items-center">
        <IconButton
          label={`Chuyển ${name} lên`}
          size="sm"
          icon={<ArrowUp size={16} />}
          disabled={index === 0}
          onClick={() => edit({ type: "topic/move", id, direction: -1 })}
        />
        <IconButton
          label={`Chuyển ${name} xuống`}
          size="sm"
          icon={<ArrowDown size={16} />}
          disabled={index === count - 1}
          onClick={() => edit({ type: "topic/move", id, direction: 1 })}
        />
        <IconButton
          label={`Xóa ${name}`}
          size="sm"
          icon={<Trash size={16} />}
          onClick={() => onRemove(topic)}
        />
      </div>
    </div>
  );
}
