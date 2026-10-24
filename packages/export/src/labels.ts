import type { MinutesLang, TopicStatus } from "@recap/core";

export interface Labels {
  minutes: string;
  date: string;
  duration: string;
  summary: string;
  topics: string;
  actionItems: string;
  openIssues: string;
  task: string;
  owner: string;
  due: string;
  page: string;
  of: string;
  noActions: string;
  status: Record<TopicStatus, string>;
}

export const LABELS: Record<MinutesLang, Labels> = {
  vi: {
    minutes: "Biên bản cuộc họp",
    date: "Thời gian",
    duration: "Thời lượng",
    summary: "Tóm tắt",
    topics: "Nội dung thảo luận",
    actionItems: "Việc cần làm",
    openIssues: "Vấn đề còn mở",
    task: "Công việc",
    owner: "Phụ trách",
    due: "Hạn",
    page: "Trang",
    of: "/",
    noActions: "Không có",
    status: { decided: "Đã thống nhất", open: "Còn bỏ ngỏ", rejected: "Đã loại" },
  },
  en: {
    minutes: "Meeting minutes",
    date: "Date",
    duration: "Duration",
    summary: "Summary",
    topics: "Discussion",
    actionItems: "Action items",
    openIssues: "Open issues",
    task: "Task",
    owner: "Owner",
    due: "Due",
    page: "Page",
    of: "/",
    noActions: "None",
    status: { decided: "Agreed", open: "Still open", rejected: "Dismissed" },
  },
};
