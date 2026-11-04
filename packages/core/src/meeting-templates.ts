import { z } from "zod";

/** Meeting types ("loại cuộc họp"); each one adds guidance to the minutes prompt (see @recap/minutes). */
export const MEETING_TEMPLATES = [
  {
    id: "general",
    label: "Họp chung",
    description: "Cuộc họp thông thường, không thiên về mảng nào.",
    tagline: "Họp thông thường, trao đổi chung",
    bestFor: "Không chắc chọn loại nào thì dùng loại này",
    focus: [
      "Chủ đề đã bàn và ý chính",
      "Quyết định đã thống nhất",
      "Việc cần làm và vấn đề còn bỏ ngỏ",
    ],
  },
  {
    id: "project",
    label: "Họp dự án",
    description: "Chủ đề, quyết định, việc cần làm kèm người phụ trách, hạn và vướng mắc.",
    tagline: "Theo dõi tiến độ, giao việc và vướng mắc",
    bestFor: "Họp có việc giao cho từng người, có mốc thời gian",
    focus: [
      "Tiến độ, con số và mốc thời gian",
      "Việc cần làm kèm người phụ trách và hạn",
      "Vướng mắc, rủi ro và việc phụ thuộc",
    ],
  },
  {
    id: "client",
    label: "Họp khách hàng",
    description: "Nhu cầu và băn khoăn của khách, cam kết hai bên, bước tiếp theo.",
    tagline: "Làm việc với khách, ghi rõ cam kết hai bên",
    bestFor: "Cần ghi rõ ai cam kết gì với ai",
    focus: [
      "Nhu cầu, mong muốn và băn khoăn của khách",
      "Cam kết của mỗi bên (giá, phạm vi, thời gian)",
      "Bước tiếp theo và câu hỏi chưa trả lời",
    ],
  },
  {
    id: "interview",
    label: "Phỏng vấn",
    description: "Câu hỏi đã hỏi, câu trả lời đáng chú ý, điểm mạnh và điểm cần cân nhắc.",
    tagline: "Ghi lại hỏi đáp và đánh giá ứng viên",
    bestFor: "Cần so sánh ứng viên sau nhiều buổi",
    focus: [
      "Câu hỏi đã hỏi theo từng mảng",
      "Câu trả lời đáng chú ý kèm dữ kiện",
      "Điểm mạnh, điểm cần cân nhắc và việc theo dõi",
    ],
  },
  {
    id: "training",
    label: "Đào tạo/Webinar",
    description: "Nội dung chính, khái niệm và thuật ngữ, câu hỏi nêu ra, tài liệu được nhắc.",
    tagline: "Bài giảng, hội thảo, webinar có người trình bày",
    bestFor: "Muốn giữ lại kiến thức và thuật ngữ đã nghe",
    focus: [
      "Nội dung theo thứ tự trình bày",
      "Khái niệm, thuật ngữ, ví dụ và số liệu",
      "Câu hỏi của người nghe và tài liệu được nhắc",
    ],
  },
] as const;

/**
 * Types kept in the registry (existing meetings, the API and the prompts still know them) but not
 * offered in the picker. A meeting that already has one still shows it as selected.
 */
export const HIDDEN_TEMPLATE_IDS: readonly string[] = ["interview"];

export type MeetingTemplateInfo = (typeof MEETING_TEMPLATES)[number];

export function getMeetingTemplate(id: string): MeetingTemplateInfo | undefined {
  return MEETING_TEMPLATES.find((t) => t.id === id);
}

export type MeetingTemplateId = (typeof MEETING_TEMPLATES)[number]["id"];

export const MEETING_TEMPLATE_IDS = MEETING_TEMPLATES.map((t) => t.id) as [
  MeetingTemplateId,
  ...MeetingTemplateId[],
];
export const DEFAULT_TEMPLATE_ID: MeetingTemplateId = "general";

export const meetingTemplateIdSchema = z.enum(MEETING_TEMPLATE_IDS, {
  error: "Loại cuộc họp không hợp lệ",
});

/** Max length of the per-meeting extra instructions (after trimming). */
export const EXTRA_INSTRUCTIONS_MAX = 500;

export const extraInstructionsSchema = z
  .string()
  .trim()
  .max(EXTRA_INSTRUCTIONS_MAX, `Hướng dẫn thêm tối đa ${EXTRA_INSTRUCTIONS_MAX} ký tự`);

const WHITESPACE_RUN = /\s+/g;

/** One-line canonical form (what the prompt and the fingerprint use); null when blank. */
export function normalizeExtraInstructions(text: string | null | undefined): string | null {
  const flat = (text ?? "").replace(WHITESPACE_RUN, " ").trim();
  return flat === "" ? null : flat;
}

export function isMeetingTemplateId(value: unknown): value is MeetingTemplateId {
  return MEETING_TEMPLATES.some((t) => t.id === value);
}

export function templateLabel(id: string): string {
  return getMeetingTemplate(id)?.label ?? id;
}
