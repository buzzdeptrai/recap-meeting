/** Sample data (Oct 2026, 22 days) lifted from design/admin-preview-v3. All prices are examples. */
export const DG = [
  1.34, 3.49, 0, 0, 1.65, 2.35, 3.18, 1.91, 2.54, 0, 0, 1.07, 3.22, 2.88, 2.07, 3.03, 1.11, 0, 0.8,
  1.74, 2.1, 2.11,
];
export const OP = [
  0.17, 0.31, 0.22, 0, 0.11, 0.26, 0.36, 0.33, 0.29, 0.16, 0, 0.07, 0.28, 0.39, 0.32, 0.33, 0.27,
  0.07, 0.05, 0.16, 0.25, 0.25,
];
export const GE = [
  0.02, 0.06, 0, 0, 0.03, 0.03, 0.05, 0.04, 0.05, 0, 0, 0.02, 0.06, 0.05, 0.03, 0.06, 0.02, 0, 0.01,
  0.03, 0.03, 0.04,
];
export const MEETINGS = [2, 3, 0, 0, 2, 3, 3, 2, 3, 0, 0, 1, 3, 3, 2, 3, 1, 0, 1, 2, 2, 2];
export const COST = DG.map((v, i) => v + (OP[i] ?? 0) + (GE[i] ?? 0));
export const HOURS = DG.map((v) => (v * 79.2) / 36.59);
export const DAYS = Array.from({ length: 22 }, (_, i) => `${i + 1}/10`);

export interface RecentMeeting {
  title: string;
  meta: string;
  langs: ("VI" | "EN")[];
  status: "rec" | "ok" | "warn";
  statusLabel: string;
}

export const RECENT: RecentMeeting[] = [
  {
    title: "Rà soát hợp đồng cung ứng Q4",
    meta: "22/10 10:12 · 00:24:05",
    langs: ["VI", "EN"],
    status: "rec",
    statusLabel: "Đang ghi",
  },
  {
    title: "Họp chuẩn bị kế hoạch triển khai",
    meta: "22/10 08:30 · 01:07:42",
    langs: ["VI"],
    status: "ok",
    statusLabel: "Hoàn tất",
  },
  {
    title: "Họp giá quý 4 với nhà cung cấp",
    meta: "21/10 14:00 · 00:52:18",
    langs: ["VI", "EN"],
    status: "ok",
    statusLabel: "Hoàn tất",
  },
  {
    title: "Đồng bộ roadmap sản phẩm Q1",
    meta: "21/10 09:00 · 01:31:10",
    langs: ["EN"],
    status: "ok",
    statusLabel: "Hoàn tất",
  },
  {
    title: "Phỏng vấn ứng viên Backend",
    meta: "20/10 15:30 · 00:48:55",
    langs: ["VI"],
    status: "warn",
    statusLabel: "Chưa có biên bản",
  },
];

export const SERVICES = [
  { name: "Deepgram", desc: "Chép lời trực tiếp · nova-3", p95: "412 ms", err: "0,1%" },
  { name: "Gemini", desc: "Dịch trực tiếp · flash-lite", p95: "680 ms", err: "0,2%" },
  { name: "OpenAI", desc: "Tạo biên bản · gpt-4.1", p95: "2,4 s", err: "0,4%" },
];

export interface VendorRow {
  id: string;
  name: string;
  models: string;
  color: string;
  seconds: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  calls: number;
  cost: number;
}

export const VENDORS: VendorRow[] = [
  {
    id: "dg",
    name: "Deepgram",
    models: "nova-3",
    color: "#1D4ED8",
    seconds: 285120,
    tokensIn: null,
    tokensOut: null,
    calls: 61,
    cost: 36.59,
  },
  {
    id: "oa",
    name: "OpenAI",
    models: "gpt-4.1, gpt-4.1-mini",
    color: "#FF0080",
    seconds: null,
    tokensIn: 1830000,
    tokensOut: 300000,
    calls: 223,
    cost: 4.65,
  },
  {
    id: "ge",
    name: "Gemini",
    models: "gemini-3.1-flash-lite",
    color: "#3A416F",
    seconds: null,
    tokensIn: 3840000,
    tokensOut: 620000,
    calls: 5210,
    cost: 0.63,
  },
];
