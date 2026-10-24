#!/usr/bin/env node
/* eslint-disable max-lines-per-function -- QA/demo tooling, linear scripts */
/**
 * Seeds ~60 varied SYNTHETIC meetings for previewing the meetings list (statuses, languages,
 * minutes states incl. stale, marks, agenda, costs). NEVER writes to recap.db.
 *
 * Usage:  npx tsx scripts/seed-meetings-demo.mjs [dbPath] [--force]
 *   dbPath   default data/demo-list.db (relative to the repo root)
 *   --force  add meetings even if the DB already has some
 * Preview: DB_PATH=./data/demo-list.db PORT=3101 npm run dev -w @recap/web -- --port 3101
 */
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRepositories, openDatabase } from "@recap/db";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--")) ?? "data/demo-list.db";
const dbPath = isAbsolute(target) ? target : resolve(ROOT, target);
if (basename(dbPath).startsWith("recap.db")) {
  console.error("Refusing to seed the real database (recap.db). Use data/demo-list.db.");
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
let clock = Date.now();
const repos = createRepositories(db, { now: () => new Date(clock).toISOString() });
const at = (ms) => {
  clock = ms;
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const VN = 7 * HOUR;
const startOfVnDay = (ms) => Math.floor((ms + VN) / DAY) * DAY - VN;
const today = startOfVnDay(Date.now());

const TITLES = [
  "Họp giao ban tuần",
  "Review sprint 42",
  "Khách hàng ABC: đàm phán hợp đồng",
  "Kế hoạch ngân sách Q4",
  "Đào tạo nội bộ: quy trình bán hàng",
  "Demo sản phẩm cho đối tác",
  "Weekly sync with Singapore team",
  "Quarterly business review",
  "Phỏng vấn ứng viên Backend",
  "Retro dự án Mekong",
  "Thống nhất giá với nhà cung cấp",
  "Product roadmap workshop",
  "Họp ban điều hành tháng 10",
  "Onboarding nhân sự mới",
  "Kickoff dự án chuyển đổi số cho ngân hàng và bảo hiểm khu vực Đông Nam Á giai đoạn hai",
];
const AGENDAS = [
  "1. Cập nhật tiến độ\n2. Rủi ro\n3. Việc tuần sau",
  "- Chốt giá Q4 với đối tác\n- Điều khoản thanh toán",
  "Review backlog and priorities for next sprint",
  null,
  null,
];
const LINES = [
  "Chúng ta cần chốt ngân sách trước cuối tháng này.",
  "We can hold the price at 345 if they sign this quarter.",
  "Hợp đồng sẽ được gửi cho khách hàng vào thứ Sáu.",
  "The main risk is the delivery timeline for phase two.",
  "Giá đề xuất là ba trăm bốn mươi lăm đô la mỗi tháng.",
];
const CONCLUSIONS = [
  "Giữ giá 345 nếu ký trong quý này",
  "Gửi hợp đồng cho khách trước thứ Sáu",
  "Hoãn phase hai sang tháng 12",
  "Approve the Q4 budget",
];
const content = { summary: "Tóm tắt demo.", topics: [], actionItems: [], openIssues: [] };

function addMeeting(created, spec) {
  at(created);
  const m = repos.meetings.create({
    title: spec.title,
    sourceLang: spec.lang,
    targetLang: spec.lang === "en" ? "vi" : spec.lang === "multi" ? "vi" : "en",
    agenda: spec.agenda,
  });
  if (spec.status === "draft") return m;
  const started = created + 2 * MIN;
  at(started);
  repos.meetings.start(m.id, new Date(started).toISOString());
  if (spec.status === "live") {
    addSegments(m.id, 6, started);
    return m;
  }
  const wall = spec.minutes * MIN;
  const ended = started + wall;
  addSegments(m.id, spec.segments, started);
  spec.conclusions.forEach((label, i) => {
    at(started + (i + 1) * 3 * MIN);
    repos.marks.insert({ meetingId: m.id, kind: "conclusion", atMs: (i + 1) * 3 * MIN, label });
  });
  for (let i = 0; i < spec.topics; i++) {
    at(started + i * 2 * MIN);
    repos.marks.insert({
      meetingId: m.id,
      kind: "topic",
      atMs: i * 2 * MIN,
      label: `Chủ đề ${i + 1}`,
    });
  }
  at(ended);
  repos.meetings.end(m.id, new Date(ended).toISOString(), Math.round(wall * (0.8 + rand() * 0.2)));
  at(ended + MIN);
  for (const lang of spec.minutesLangs) {
    repos.minutes.upsert({ meetingId: m.id, lang, content, source: "ai" });
    if (spec.edited) {
      at(ended + 5 * MIN);
      repos.minutes.upsert({ meetingId: m.id, lang, content, source: "edited" });
    }
  }
  if (spec.stale) {
    at(ended + 2 * HOUR);
    repos.segments.insert({
      meetingId: m.id,
      seq: 9999,
      channel: 0,
      lang: "vi",
      startMs: 0,
      endMs: 1,
      text: "Bổ sung sau khi họp lại.",
    });
  }
  if (spec.cost) {
    at(ended);
    repos.usage.record({
      ts: new Date(ended).toISOString(),
      meetingId: m.id,
      vendor: "deepgram",
      service: "stt_live",
      model: "nova-3",
      audioSeconds: wall / 500,
      status: "ok",
      costUsd: spec.cost * 0.6,
    });
    repos.usage.record({
      ts: new Date(ended).toISOString(),
      meetingId: m.id,
      vendor: "gemini",
      service: "translate",
      model: "gemini-flash",
      inputTokens: 900,
      outputTokens: 700,
      status: "ok",
      costUsd: spec.cost * 0.4,
    });
  }
  return m;
}

function addSegments(meetingId, n, startedAt) {
  for (let seq = 0; seq < n; seq++) {
    at(startedAt + seq * 20_000);
    repos.segments.insert({
      meetingId,
      seq,
      channel: seq % 2,
      lang: "vi",
      startMs: seq * 20_000,
      endMs: seq * 20_000 + 5_000,
      text: pick(LINES),
    });
  }
}

const langs = ["vi", "en", "multi", "multi", "auto"];
function randomSpec(index, status = "ended") {
  const minutesChoice = pick(["none", "none", "vi", "en", "both", "both", "stale"]);
  const minutesLangs =
    minutesChoice === "none"
      ? []
      : minutesChoice === "both" || minutesChoice === "stale"
        ? ["vi", "en"]
        : [minutesChoice];
  return {
    title: TITLES[index % TITLES.length],
    lang: pick(langs),
    agenda: pick(AGENDAS),
    status,
    minutes: Math.round(5 + rand() * 100),
    segments: Math.round(8 + rand() * 40),
    topics: pick([0, 0, 1, 2, 4]),
    conclusions:
      rand() < 0.5 ? [] : [pick(CONCLUSIONS), pick(CONCLUSIONS)].slice(0, 1 + Math.round(rand())),
    minutesLangs,
    edited: minutesChoice === "en" || (minutesChoice === "both" && rand() < 0.4),
    stale: minutesChoice === "stale",
    cost: rand() < 0.75 ? Math.round((0.01 + rand() * 0.6) * 10000) / 10000 : 0,
  };
}

let index = 0;
// Today and yesterday: dense, including a live and a draft meeting.
addMeeting(Date.now() - 25 * MIN, randomSpec(index++, "live"));
addMeeting(today + 9 * HOUR, randomSpec(index++));
addMeeting(today + 7 * HOUR + 30 * MIN, randomSpec(index++));
addMeeting(today + 6 * HOUR, randomSpec(index++));
addMeeting(today + 10 * HOUR, { ...randomSpec(index++, "draft") });
for (let k = 0; k < 4; k++) addMeeting(today - DAY + (8 + k * 2) * HOUR, randomSpec(index++));
// Older: 1-3 per day over the last 45 days.
for (let d = 2; d <= 45; d++) {
  const count = rand() < 0.3 ? 0 : 1 + Math.floor(rand() * 2);
  for (let k = 0; k < count; k++)
    addMeeting(
      today - d * DAY + (8 + k * 3) * HOUR + Math.floor(rand() * HOUR),
      randomSpec(index++, rand() < 0.05 ? "draft" : "ended"),
    );
}
console.log(`Seeded ${index} meetings into ${dbPath}`);
db.close();
