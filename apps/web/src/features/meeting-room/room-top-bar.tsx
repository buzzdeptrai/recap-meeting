"use client";

import { ArrowLeft, Columns, MagnifyingGlass, Rows, Translate } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { TargetLang } from "@recap/core";
import {
  iconButtonVariants,
  Kbd,
  SegmentedControl,
  Tooltip,
  type SegmentOption,
} from "@recap/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { formatClock } from "@/lib/format";
import { MEETING_STATUS, RECORDING_STATUS } from "@/lib/status";
import { EditableTitle } from "./editable-title";
import { LANG_NAME } from "./row-parts";
import type { ViewMode } from "./segment-row";

const VIEW_OPTIONS: ReadonlyArray<SegmentOption<ViewMode>> = [
  { value: "both", label: "Song song", icon: <Columns size={16} /> },
  { value: "source", label: "Gốc", icon: <Rows size={16} /> },
  { value: "translation", label: "Bản dịch", icon: <Translate size={16} /> },
];

export type RecState = "idle" | "recording" | "reconnecting" | "ended";

function Clock({ ms }: { ms: number }) {
  return (
    <span className="font-soft-mono text-[15px] font-bold tabular-nums">{formatClock(ms)}</span>
  );
}

function RecIndicator({
  state,
  elapsedMs,
  durationMs,
}: {
  state: RecState;
  elapsedMs: number;
  durationMs: number | null;
}) {
  if (state === "idle") return <StatusBadge status={RECORDING_STATUS.idle} />;
  if (state === "ended") {
    return (
      <span className="flex items-center gap-2">
        <StatusBadge status={MEETING_STATUS.ended} />
        {durationMs !== null && <Clock ms={durationMs} />}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2" aria-live="off">
      <StatusBadge
        status={RECORDING_STATUS[state]}
        className={state === "recording" ? "rec-pulse tracking-[0.06em]" : undefined}
      />
      <Clock ms={elapsedMs} />
    </span>
  );
}

interface SearchPillProps {
  open: boolean;
  onClick: () => void;
}

/** Looks like a search field; opens the real search bar above the transcript (also Ctrl/Cmd+F). */
function SearchPill({ open, onClick }: SearchPillProps) {
  return (
    <button
      type="button"
      aria-label="Tìm trong bản ghi (Ctrl+F)"
      aria-pressed={open}
      onClick={onClick}
      className="soft-focus inline-flex h-10 min-w-0 max-[1559px]:w-10 max-[1559px]:justify-center max-[1559px]:px-0 cursor-pointer items-center gap-2 rounded-soft-pill bg-soft-inset px-3.5 text-[13px] text-soft-muted shadow-[inset_0_0_0_1px_var(--soft-line-strong)] hover:bg-soft-inset-2 hover:text-soft-ink aria-pressed:bg-soft-tonal-bg aria-pressed:font-semibold aria-pressed:text-soft-tonal-ink"
    >
      <MagnifyingGlass size={16} aria-hidden />
      <span className="max-[1559px]:hidden">Tìm trong bản ghi</span>
      <Kbd className="max-[1559px]:hidden">Ctrl F</Kbd>
    </button>
  );
}

interface RoomTopBarProps {
  meetingId: string;
  title: string;
  rec: RecState;
  elapsedMs: number;
  durationMs: number | null;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  /** The language translations are shown in (stated once here, not on every row). */
  targetLang: TargetLang;
  /** Opens the in-transcript search (also Ctrl/Cmd+F). */
  onSearch: () => void;
  searchOpen: boolean;
  /** Exactly one primary action for the current state. */
  action: ReactNode;
}

/** First row of the header card (the card itself is `RoomHeader`). */
export function RoomTopBar(props: RoomTopBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 sm:gap-x-4">
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-1">
        <Link href="/meetings" aria-label="Về danh sách cuộc họp" className={iconButtonVariants()}>
          <ArrowLeft size={18} />
        </Link>
        <EditableTitle meetingId={props.meetingId} initialTitle={props.title} />
      </div>
      <RecIndicator state={props.rec} elapsedMs={props.elapsedMs} durationMs={props.durationMs} />
      <SearchPill open={props.searchOpen} onClick={props.onSearch} />
      <ViewModeControl view={props.view} onChange={props.onViewChange} target={props.targetLang} />
      {props.action}
    </div>
  );
}

interface ViewModeControlProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
  target: TargetLang;
}

/** Source / translation switch; the language translations are in is stated here, once. */
function ViewModeControl({ view, onChange, target }: ViewModeControlProps) {
  const name = LANG_NAME[target] ?? target;
  return (
    <Tooltip content={`Dịch sang ${name}`}>
      <div className="max-[639px]:order-last max-[639px]:w-full">
        <SegmentedControl
          ariaLabel={`Chế độ hiển thị, dịch sang ${name}`}
          options={VIEW_OPTIONS}
          value={view}
          onValueChange={onChange}
          size="sm"
          variant="soft"
          className="max-[639px]:w-full max-[639px]:[&>*]:flex-1"
        />
      </div>
    </Tooltip>
  );
}
