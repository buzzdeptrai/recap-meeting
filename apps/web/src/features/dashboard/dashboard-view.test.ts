import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadDashboard, type MeetingSource } from "./dashboard-data";
import { buildDashboardModel } from "./dashboard-model";
import { DashboardView } from "./dashboard-view";

const NOW = Date.parse("2026-10-15T05:00:00Z");
const pricing = { version: 1 as const, currency: "USD" as const, entries: [] };
const LEAKS = /Giờ chép lời|Token|Chi phí|ngân sách|\$\d|USD/i;

function render(
  source: Partial<MeetingSource>,
  seed: (repos: ReturnType<typeof createRepositories>) => void = () => {},
) {
  const repos = createRepositories(openDatabase(IN_MEMORY));
  seed(repos);
  const deps = { repos, now: () => NOW, budgetUsd: 60, pricing };
  const model = buildDashboardModel(loadDashboard(NOW, deps, source));
  return renderToStaticMarkup(createElement(DashboardView, { model }));
}

describe("DashboardView render", () => {
  it("shows friendly empty states and no fabricated figures without meetings", () => {
    const html = render({});
    expect(html).toContain("Chưa có cuộc họp trong tháng 10");
    expect(html).toContain("Chưa có cuộc họp nào");
    expect(html).toContain("Không có gì tồn đọng");
    expect(html).toContain("Cuộc họp mới");
    expect(html).not.toMatch(LEAKS);
  });

  it("renders meeting cards, links and service health, never money or tokens", () => {
    const html = render(
      {
        meetings: [{ createdAt: "2026-10-10T03:00:00Z", startedAt: null, durationMs: 3_600_000 }],
        needMinutes: 2,
        conclusions: 1,
        ended: [
          {
            id: "a",
            title: "Họp A",
            status: "ended",
            sourceLang: "vi",
            targetLang: "en",
            agenda: null,
            createdAt: "2026-10-10T03:00:00Z",
            startedAt: null,
            endedAt: null,
            durationMs: 1,
            minutesLangs: [],
            minutes: {},
            topicCount: 0,
            conclusionCount: 0,
            wordCount: 9,
          },
        ],
      },
      (repos) =>
        repos.usage.record({
          ts: "2026-10-10T03:00:00Z",
          vendor: "deepgram",
          service: "stt_live",
          model: "nova-3",
          audioSeconds: 3600,
          latencyMs: 400,
          status: "ok",
          costUsd: 1,
        }),
    );
    expect(html).toContain("Cuộc họp theo ngày");
    expect(html).toContain("Giờ họp");
    expect(html).toContain("Kết luận đã đánh dấu");
    expect(html).toContain('href="/meetings?minutes=need"');
    expect(html).toContain("Cần xử lý");
    expect(html).toContain("Tạo biên bản");
    expect(html).toContain("Tình trạng dịch vụ");
    expect(html).toContain("Hoạt động");
    expect(html).not.toMatch(LEAKS);
  });
});
