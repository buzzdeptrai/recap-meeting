#!/usr/bin/env node
/* eslint-disable max-lines-per-function -- QA/demo tooling, linear script */
/**
 * Seeds two SYNTHETIC long meetings for testing the virtualized transcript:
 *   - "Họp 2 giờ" : ~2,400 segments (+ translations), 15 marks incl. topic markers
 *   - "Họp 6 giờ" : ~7,500 segments (+ translations), 20 marks incl. topic markers
 * NEVER writes to recap.db.
 *
 * Usage:  npx tsx scripts/seed-long-meeting.mjs [dbPath] [--force]
 *   dbPath   default data/demo-long.db (relative to the repo root)
 *   --force  add meetings even if the DB already has some
 * Preview: DB_PATH=./data/demo-long.db NEXT_DIST_DIR=.next-long npm run dev -w @recap/web -- --port 3102
 */
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRepositories, openDatabase } from "@recap/db";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--")) ?? "data/demo-long.db";
const dbPath = isAbsolute(target) ? target : resolve(ROOT, target);
if (basename(dbPath).startsWith("recap.db")) {
  console.error("Refusing to seed the real database (recap.db). Use data/demo-long.db.");
  process.exit(1);
}

let seed = 20261022;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];

const db = openDatabase(dbPath);
if (db.prepare("SELECT COUNT(*) FROM meetings").pluck().get() > 0 && !args.includes("--force")) {
  console.error(`${dbPath} already has meetings; pass --force to add more.`);
  process.exit(1);
}
const repos = createRepositories(db);

const MIN = 60_000;
const VI = [
  "Chúng ta cần chốt ngân sách trước cuối tháng này.",
  "Hợp đồng sẽ được gửi cho khách hàng vào thứ Sáu.",
  "Giá đề xuất là ba trăm bốn mươi lăm đô la mỗi tháng, chưa bao gồm thuế.",
  "Anh có thể chia sẻ màn hình để cả nhóm cùng xem số liệu không?",
  "Rủi ro lớn nhất là tiến độ giao hàng của giai đoạn hai.",
  "Đội kỹ thuật cần thêm hai tuần để hoàn thành phần tích hợp thanh toán.",
  "Tôi đồng ý với đề xuất đó, nhưng cần xác nhận lại với bên pháp chế.",
  "Vâng.",
  "Được rồi, vậy mình chuyển sang mục tiếp theo nhé.",
  "Khách hàng yêu cầu bổ sung điều khoản bảo mật dữ liệu và thời hạn lưu trữ nhật ký hệ thống ít nhất mười hai tháng, đồng thời muốn có báo cáo kiểm toán hằng quý.",
  "Số liệu quý ba cho thấy doanh thu tăng mười hai phần trăm so với cùng kỳ năm ngoái.",
  "Chúng tôi sẽ gửi bản cập nhật vào đầu tuần sau.",
];
const EN = [
  "We can hold the price at 345 if they sign this quarter.",
  "The main risk is the delivery timeline for phase two.",
  "Could you share your screen so everyone can see the numbers?",
  "I agree with the proposal, but we need legal to confirm the data retention clause.",
  "Right.",
  "Let's move on to the next item on the agenda.",
  "The customer asked for an audit report every quarter and log retention of at least twelve months, which affects our storage budget for the next fiscal year.",
  "Revenue in the third quarter grew twelve percent compared with last year.",
  "The integration with the payment provider needs two more weeks.",
  "We'll send the updated plan early next week.",
];
// Fake "translation" of each line: the other language's sentence, prefixed so it differs.
const TOPICS = [
  "Ngân sách Q4",
  "Điều khoản hợp đồng",
  "Tiến độ giai đoạn hai",
  "Rủi ro và phụ thuộc",
  "Nhân sự và đào tạo",
  "Kế hoạch ra mắt",
  "Báo cáo tài chính",
  "Hạ tầng và bảo mật",
];
const CONCLUSIONS = [
  "Giữ giá 345 nếu ký trong quý này",
  "Gửi hợp đồng cho khách trước thứ Sáu",
  "Hoãn phase hai sang tháng 12",
  "Approve the Q4 budget",
  "Thêm điều khoản bảo mật dữ liệu",
  "Tuyển thêm hai kỹ sư tích hợp",
];

function seedMeeting({ title, minutes, perMinute, marks }) {
  const count = Math.round(minutes * perMinute);
  const stepMs = (minutes * MIN) / count;
  const started = Date.now() - minutes * MIN - 3_600_000;
  const meeting = repos.meetings.create({
    title,
    sourceLang: "multi",
    targetLang: "vi",
    agenda: "1. Ngân sách\n2. Hợp đồng\n3. Tiến độ",
  });
  repos.meetings.start(meeting.id, new Date(started).toISOString());
  const run = db.transaction(() => {
    const ids = [];
    for (let seq = 0; seq < count; seq++) {
      const english = rand() < 0.35;
      const text = english ? pick(EN) : pick(VI);
      const startMs = Math.round(seq * stepMs);
      const segment = repos.segments.insert({
        meetingId: meeting.id,
        seq,
        channel: rand() < 0.4 ? 0 : 1,
        lang: english ? "en" : "vi",
        startMs,
        endMs: startMs + Math.round(stepMs * 0.9),
        text: `${text} (${seq + 1})`,
      });
      ids.push(segment);
      repos.translations.upsert({
        segmentId: segment.id,
        lang: english ? "vi" : "en",
        text: english ? `Bản dịch: ${pick(VI)}` : `Translation: ${pick(EN)}`,
        provider: "gemini",
        latencyMs: 400 + Math.round(rand() * 600),
      });
    }
    // Alternate topic and conclusion markers across the whole timeline.
    for (let i = 0; i < marks; i++) {
      const topic = i % 2 === 0;
      const seg = ids[Math.min(count - 1, Math.floor(((i + 1) * count) / (marks + 1)))];
      repos.marks.insert({
        meetingId: meeting.id,
        kind: topic ? "topic" : "conclusion",
        atMs: seg.startMs,
        label: topic
          ? TOPICS[(i / 2) % TOPICS.length]
          : CONCLUSIONS[((i - 1) / 2) % CONCLUSIONS.length],
      });
    }
  });
  run();
  repos.meetings.end(meeting.id, new Date(started + minutes * MIN).toISOString(), minutes * MIN);
  console.log(`${title}: ${count} segments, ${marks} marks -> ${meeting.id}`);
}

seedMeeting({
  title: "Họp 2 giờ: rà soát ngân sách và hợp đồng",
  minutes: 120,
  perMinute: 20,
  marks: 15,
});
seedMeeting({
  title: "Họp 6 giờ: workshop kế hoạch năm",
  minutes: 360,
  perMinute: 20.8,
  marks: 20,
});
db.close();
