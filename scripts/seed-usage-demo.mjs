#!/usr/bin/env node
/**
 * Seeds ~30 days of realistic SYNTHETIC usage events (plus demo meetings) for previewing the
 * usage UI. NEVER writes to recap.db: the target path is refused if it looks like the real DB.
 *
 * Usage:  npx tsx scripts/seed-usage-demo.mjs [dbPath] [--days 30] [--force]
 *   dbPath   default data/demo.db (relative to the repo root)
 *   --force  add rows even if the DB already has usage events
 * Preview: DB_PATH=./data/demo.db npm run dev:web   (web reads DB_PATH from .env / environment)
 */
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeCostUsd } from "@recap/core";
import { loadPricingFile } from "@recap/core/node";
import { createRepositories, openDatabase } from "@recap/db";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const days = Number(args[args.indexOf("--days") + 1]) || 30;
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--days");
const target = positional[0] ?? "data/demo.db";
const dbPath = isAbsolute(target) ? target : resolve(ROOT, target);

if (basename(dbPath).startsWith("recap.db")) {
  console.error("Refusing to seed the real database (recap.db). Use data/demo.db.");
  process.exit(1);
}

// Small deterministic PRNG so the demo data is reproducible.
let seed = 20261022;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (lo, hi) => lo + rand() * (hi - lo);

const repos = createRepositories(openDatabase(dbPath));
const pricing = loadPricingFile();
const DAY_MS = 86_400_000;
const existing = repos.usage.totals({
  from: "2000-01-01T00:00:00.000Z",
  to: "2999-01-01T00:00:00.000Z",
});
if (existing.requests > 0 && !flag("--force")) {
  console.error(`${dbPath} already has usage events; pass --force to add more.`);
  process.exit(1);
}

const TITLES = [
  "Họp tuần",
  "Review sprint",
  "Khách hàng ABC",
  "Kế hoạch Q4",
  "Đào tạo nội bộ",
  "Demo sản phẩm",
];
let inserted = 0;
function add(event) {
  const full = { ...event, requests: 1 };
  repos.usage.record({ ...full, costUsd: computeCostUsd(full, pricing) });
  inserted += 1;
}

const now = Date.now();
for (let d = days; d >= 1; d--) {
  const day = new Date(now - d * DAY_MS);
  const weekday = ![0, 6].includes(day.getUTCDay());
  const meetingsToday = weekday ? Math.floor(between(1, 4)) : rand() < 0.15 ? 1 : 0;
  for (let k = 0; k < meetingsToday; k++) {
    const start = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 2 + k * 3, 0);
    const minutes = between(15, 75);
    const title = `${TITLES[Math.floor(rand() * TITLES.length)]} ${day.toISOString().slice(5, 10)}`;
    const meeting = repos.meetings.create({ title, sourceLang: "vi", targetLang: "en" });
    const meetingId = meeting.id;
    add({
      ts: new Date(start + minutes * 60_000).toISOString(),
      meetingId,
      vendor: "deepgram",
      service: "stt_live",
      model: "nova-3",
      audioSeconds: minutes * 60 * 2,
      status: "ok",
      meta: { channels: 2, perChannelSeconds: minutes * 60, language: "multi", flush: "final" },
    });
    const segments = Math.floor(minutes * between(2, 4));
    for (let i = 0; i < segments; i++) {
      const ts = new Date(start + (i / segments) * minutes * 60_000).toISOString();
      const geminiDown = rand() < 0.04;
      const input = Math.floor(between(380, 900));
      const output = Math.floor(between(25, 120));
      if (geminiDown) {
        add({
          ts,
          meetingId,
          vendor: "gemini",
          service: "translate",
          model: "gemini-3.1-flash-lite",
          latencyMs: 1500,
          status: "error",
        });
        add({
          ts,
          meetingId,
          vendor: "openai",
          service: "translate",
          model: "gpt-4.1-mini",
          inputTokens: input,
          outputTokens: output,
          latencyMs: Math.floor(between(500, 1400)),
          status: "fallback",
        });
      } else {
        add({
          ts,
          meetingId,
          vendor: "gemini",
          service: "translate",
          model: "gemini-3.1-flash-lite",
          inputTokens: input,
          outputTokens: output,
          latencyMs: Math.floor(between(250, 900)),
          status: "ok",
        });
      }
    }
    if (rand() < 0.6) {
      add({
        ts: new Date(start + minutes * 60_000 + 120_000).toISOString(),
        meetingId,
        vendor: "openai",
        service: "minutes",
        model: "gpt-4.1",
        inputTokens: Math.floor(minutes * between(450, 700)),
        outputTokens: Math.floor(between(1200, 3200)),
        latencyMs: Math.floor(between(9000, 40000)),
        status: "ok",
      });
    }
  }
}
console.log(`Seeded ${inserted} synthetic usage events into ${dbPath}`);
