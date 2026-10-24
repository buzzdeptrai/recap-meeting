import type { ActionItem, MinutesContent, MinutesTopic, TopicStatus } from "@recap/core";

/** Pure edit operations on minutes content. New ids are passed in so the reducer stays pure. */
export type EditAction =
  | { type: "reset"; content: MinutesContent }
  | { type: "summary/set"; text: string }
  | { type: "topic/add"; id: string }
  | { type: "topic/remove"; id: string }
  | { type: "topic/move"; id: string; direction: -1 | 1 }
  | { type: "topic/title"; id: string; title: string }
  | { type: "topic/status"; id: string; status: TopicStatus }
  | { type: "keyPoint/add"; topicId: string }
  | { type: "keyPoint/set"; topicId: string; index: number; text: string }
  | { type: "keyPoint/remove"; topicId: string; index: number }
  | { type: "conclusion/add"; topicId: string }
  | { type: "conclusion/set"; topicId: string; text: string }
  | { type: "conclusion/remove"; topicId: string }
  | { type: "action/add"; id: string }
  | { type: "action/set"; id: string; field: "task" | "owner" | "due"; value: string }
  | { type: "action/remove"; id: string }
  | { type: "issue/add"; id: string }
  | { type: "issue/set"; id: string; text: string }
  | { type: "issue/remove"; id: string };

export const EMPTY_CONTENT: MinutesContent = {
  summary: "",
  topics: [],
  actionItems: [],
  openIssues: [],
};

const updateTopic = (
  content: MinutesContent,
  id: string,
  change: (topic: MinutesTopic) => MinutesTopic,
): MinutesContent => ({
  ...content,
  topics: content.topics.map((topic) => (topic.id === id ? change(topic) : topic)),
});

const replaceAt = <T>(list: T[], index: number, value: T): T[] =>
  list.map((item, i) => (i === index ? value : item));

function moveTopic(content: MinutesContent, id: string, direction: -1 | 1): MinutesContent {
  const from = content.topics.findIndex((topic) => topic.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= content.topics.length) return content;
  const topics = [...content.topics];
  const [moved] = topics.splice(from, 1);
  if (!moved) return content;
  topics.splice(to, 0, moved);
  return { ...content, topics };
}

function setActionField(
  item: ActionItem,
  field: "task" | "owner" | "due",
  value: string,
): ActionItem {
  if (field === "task") return { ...item, task: value };
  return { ...item, [field]: value };
}

function reduceTopics(content: MinutesContent, action: EditAction): MinutesContent | null {
  switch (action.type) {
    case "topic/add":
      return {
        ...content,
        topics: [
          ...content.topics,
          { id: action.id, title: "", keyPoints: [], status: "open", conclusion: null },
        ],
      };
    case "topic/remove":
      return { ...content, topics: content.topics.filter((t) => t.id !== action.id) };
    case "topic/move":
      return moveTopic(content, action.id, action.direction);
    case "topic/title":
      return updateTopic(content, action.id, (t) => ({ ...t, title: action.title }));
    case "topic/status":
      return updateTopic(content, action.id, (t) => ({ ...t, status: action.status }));
    default:
      return null;
  }
}

function reduceTopicParts(content: MinutesContent, action: EditAction): MinutesContent | null {
  switch (action.type) {
    case "keyPoint/add":
      return updateTopic(content, action.topicId, (t) => ({
        ...t,
        keyPoints: [...t.keyPoints, { text: "", atMs: null }],
      }));
    case "keyPoint/set":
      return updateTopic(content, action.topicId, (t) => {
        const point = t.keyPoints[action.index];
        if (!point) return t;
        return {
          ...t,
          keyPoints: replaceAt(t.keyPoints, action.index, { ...point, text: action.text }),
        };
      });
    case "keyPoint/remove":
      return updateTopic(content, action.topicId, (t) => ({
        ...t,
        keyPoints: t.keyPoints.filter((_, i) => i !== action.index),
      }));
    case "conclusion/add":
      return updateTopic(content, action.topicId, (t) =>
        t.conclusion ? t : { ...t, conclusion: { text: "", atMs: null, marked: false } },
      );
    case "conclusion/set":
      return updateTopic(content, action.topicId, (t) =>
        t.conclusion ? { ...t, conclusion: { ...t.conclusion, text: action.text } } : t,
      );
    case "conclusion/remove":
      return updateTopic(content, action.topicId, (t) => ({ ...t, conclusion: null }));
    default:
      return null;
  }
}

function reduceLists(content: MinutesContent, action: EditAction): MinutesContent | null {
  switch (action.type) {
    case "action/add":
      return {
        ...content,
        actionItems: [
          ...content.actionItems,
          { id: action.id, task: "", owner: null, due: null, atMs: null },
        ],
      };
    case "action/set":
      return {
        ...content,
        actionItems: content.actionItems.map((item) =>
          item.id === action.id ? setActionField(item, action.field, action.value) : item,
        ),
      };
    case "action/remove":
      return { ...content, actionItems: content.actionItems.filter((i) => i.id !== action.id) };
    case "issue/add":
      return { ...content, openIssues: [...content.openIssues, { id: action.id, text: "" }] };
    case "issue/set":
      return {
        ...content,
        openIssues: content.openIssues.map((i) =>
          i.id === action.id ? { ...i, text: action.text } : i,
        ),
      };
    case "issue/remove":
      return { ...content, openIssues: content.openIssues.filter((i) => i.id !== action.id) };
    default:
      return null;
  }
}

export function editReducer(content: MinutesContent, action: EditAction): MinutesContent {
  if (action.type === "reset") return action.content;
  if (action.type === "summary/set") return { ...content, summary: action.text };
  return (
    reduceTopics(content, action) ??
    reduceTopicParts(content, action) ??
    reduceLists(content, action) ??
    content
  );
}
