import { minutesContentSchema, type MinutesContent } from "@recap/core";

export type PrepareResult = { ok: true; content: MinutesContent } | { ok: false; message: string };

const clean = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};

/**
 * Drops rows the user left blank (empty key points, issues, actions, conclusions) and checks
 * what must not be blank. The server schema rejects empty text, so this keeps "Lưu" from 400-ing.
 */
export function prepareForSave(content: MinutesContent): PrepareResult {
  const trimmed: MinutesContent = {
    summary: content.summary.trim(),
    topics: content.topics.map((topic) => ({
      ...topic,
      title: topic.title.trim(),
      keyPoints: topic.keyPoints
        .map((point) => ({ ...point, text: point.text.trim() }))
        .filter((point) => point.text !== ""),
      conclusion:
        topic.conclusion && topic.conclusion.text.trim() !== ""
          ? { ...topic.conclusion, text: topic.conclusion.text.trim() }
          : null,
    })),
    actionItems: content.actionItems
      .map((item) => ({
        ...item,
        task: item.task.trim(),
        owner: clean(item.owner),
        due: clean(item.due),
      }))
      .filter((item) => item.task !== ""),
    openIssues: content.openIssues
      .map((issue) => ({ ...issue, text: issue.text.trim() }))
      .filter((issue) => issue.text !== ""),
  };
  if (trimmed.summary === "") return { ok: false, message: "Phần tóm tắt không được để trống." };
  if (trimmed.topics.some((topic) => topic.title === ""))
    return { ok: false, message: "Mỗi chủ đề cần có tiêu đề. Điền tiêu đề hoặc xóa chủ đề trống." };
  const parsed = minutesContentSchema.safeParse(trimmed);
  if (!parsed.success)
    return { ok: false, message: "Nội dung quá dài hoặc không hợp lệ. Hãy rút gọn rồi lưu lại." };
  return { ok: true, content: parsed.data };
}
