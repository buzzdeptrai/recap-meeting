import { inflateRawSync } from "node:zlib";
import type { MinutesContent } from "@recap/core";

/** Minimal zip reader (central directory + deflate/stored) so tests need no extra dependency. */
export function readZipEntries(zip: Buffer): Map<string, string> {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  const out = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.toString("utf8", p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const raw = zip.subarray(dataStart, dataStart + size);
    out.set(name, (method === 8 ? inflateRawSync(raw) : raw).toString("utf8"));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export const documentXml = (zip: Buffer) => readZipEntries(zip).get("word/document.xml") ?? "";

export const VI: MinutesContent = {
  summary: "Nhóm thống nhất giảm giá 5% cho khách hàng thân thiết.",
  topics: [
    {
      id: "t1",
      title: "Chính sách giá",
      status: "decided",
      keyPoints: [{ text: "Giảm giá 5% từ quý sau", atMs: 65_000 }],
      conclusion: { text: "Chốt mức 95 triệu đồng", atMs: 125_000, marked: true },
    },
    { id: "t2", title: "Kế hoạch tuyển dụng", status: "open", keyPoints: [], conclusion: null },
  ],
  actionItems: [
    { id: "a1", task: "Gửi báo giá mới", owner: "Nguyễn Văn Ánh", due: "30/10", atMs: 130_000 },
  ],
  openIssues: [{ id: "o1", text: "Chưa rõ ngân sách tuyển dụng" }],
};

export const EN: MinutesContent = {
  summary: "The team agreed on a 5% discount.",
  topics: [
    {
      id: "t1",
      title: "Pricing policy",
      status: "rejected",
      keyPoints: [{ text: "Discount from next quarter", atMs: 65_000 }],
      conclusion: { text: "Settled on 95M", atMs: null, marked: false },
    },
  ],
  actionItems: [],
  openIssues: [],
};

export const MEETING = {
  title: "Họp giá Q4",
  startedAt: "2026-10-20T03:00:00.000Z",
  durationMs: 4_500_000,
};
