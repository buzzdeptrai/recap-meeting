"use client";

import { CalendarCheck, CalendarBlank, ClockCountdown, FileText } from "@phosphor-icons/react";
import { formatNumber, StatCard, type StatCardProps } from "@recap/admin-ui";
import type { ReactNode } from "react";
import type { MeetingListTotals } from "@/lib/api-types";
import { DEFAULT_STATE, isFiltered, sameState, type ListState } from "@/lib/list-query";
import { vnDayKey, vnWeekStart } from "@/lib/vn-time";
import { formatTotalDuration } from "./meeting-format";

interface SummaryStripProps {
  state: ListState;
  totals: MeetingListTotals;
  now: number;
  onApply: (next: ListState) => void;
}

interface Tile {
  id: string;
  label: string;
  value: ReactNode;
  unit?: string;
  hint: string;
  icon: ReactNode;
  tone: NonNullable<StatCardProps["tone"]>;
  /** The state a click applies (null = nothing to apply). */
  target: ListState;
  active: boolean;
}

type TileInput = Omit<SummaryStripProps, "onApply">;

const buildTiles = (input: TileInput): Tile[] => [...sizeTiles(input), ...workTiles(input)];

function sizeTiles({ state, totals }: TileInput): Tile[] {
  const scope = isFiltered(state) ? "trong bộ lọc hiện tại" : "tất cả cuộc họp";
  return [
    {
      id: "total",
      label: "Tổng số cuộc họp",
      value: formatNumber(totals.meetings),
      hint: scope,
      icon: <CalendarBlank size={20} weight="bold" />,
      tone: "main",
      target: { ...DEFAULT_STATE, sort: state.sort },
      active: !isFiltered(state),
    },
    {
      id: "duration",
      label: "Tổng thời lượng",
      value: formatTotalDuration(totals.durationMs),
      unit: "giờ:phút",
      hint: "xếp theo thời lượng",
      icon: <ClockCountdown size={20} weight="bold" />,
      tone: "blue",
      target: { ...state, sort: "duration" },
      active: state.sort === "duration",
    },
  ];
}

function workTiles({ state, totals, now }: TileInput): Tile[] {
  const week: ListState = {
    ...state,
    range: "custom",
    from: vnDayKey(vnWeekStart(now)),
    to: vnDayKey(now),
  };
  const need: ListState = { ...state, status: "ended", minutes: "need" };
  return [
    {
      id: "week",
      label: "Cuộc họp tuần này",
      value: formatNumber(totals.thisWeek),
      hint: "tính từ thứ Hai",
      icon: <CalendarCheck size={20} weight="bold" />,
      tone: "green",
      target: week,
      active: sameState(state, week),
    },
    {
      id: "need",
      label: "Biên bản chờ tạo/duyệt",
      value: formatNumber(totals.needMinutes),
      hint: "chưa có hoặc đã cũ",
      icon: <FileText size={20} weight="bold" />,
      tone: "orange",
      target: need,
      active: state.minutes === "need" && state.status === "ended",
    },
  ];
}

/** Four compact KPI tiles; each is a button that applies the filter it describes. */
export function SummaryStrip(props: SummaryStripProps) {
  const tiles = buildTiles(props);
  return (
    <section
      aria-label="Tóm tắt danh sách"
      className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
    >
      {tiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          aria-pressed={tile.active}
          onClick={() =>
            props.onApply(
              tile.active && tile.id !== "total"
                ? { ...props.state, ...resetFor(tile.id) }
                : tile.target,
            )
          }
          className="soft-focus group cursor-pointer rounded-soft text-left transition-transform duration-150 hover:-translate-y-px aria-pressed:ring-2 aria-pressed:ring-soft-purple/40"
        >
          <StatCard
            className="h-full p-4! sm:p-5!"
            label={tile.label}
            value={tile.value}
            unit={tile.unit}
            deltaLabel={tile.hint}
            icon={tile.icon}
            tone={tile.tone}
          />
        </button>
      ))}
    </section>
  );
}

/** Clicking an active tile again undoes what it applied. */
function resetFor(id: string): Partial<ListState> {
  if (id === "duration") return { sort: "auto" };
  if (id === "week") return { range: "all", from: "", to: "" };
  if (id === "need") return { minutes: "all" };
  return {};
}
