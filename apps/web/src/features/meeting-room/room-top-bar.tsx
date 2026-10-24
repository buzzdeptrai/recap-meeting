"use client";

import { ArrowLeft, Columns, MagnifyingGlass, Rows, Translate } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  IconButton,
  iconButtonVariants,
  SegmentedControl,
  type SegmentOption,
} from "@recap/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { formatClock } from "@/lib/format";
import { MEETING_STATUS, RECORDING_STATUS } from "@/lib/status";
import { EditableTitle } from "./editable-title";
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
  const status = RECORDING_STATUS[state];
  return (
    <span className="flex items-center gap-2" aria-live="off">
      <StatusBadge status={status} className={state === "recording" ? "tracking-[0.08em]" : ""} />
      <Clock ms={elapsedMs} />
    </span>
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
  /** Opens the in-transcript search (also Ctrl/Cmd+F). */
  onSearch: () => void;
  searchOpen: boolean;
  action: ReactNode;
}

export function RoomTopBar(props: RoomTopBarProps) {
  return (
    <header className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2 bg-soft-surface px-4 py-2.5 shadow-soft-sm">
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-1">
        <Link href="/meetings" aria-label="Về danh sách cuộc họp" className={iconButtonVariants()}>
          <ArrowLeft size={18} />
        </Link>
        <EditableTitle meetingId={props.meetingId} initialTitle={props.title} />
      </div>
      <RecIndicator state={props.rec} elapsedMs={props.elapsedMs} durationMs={props.durationMs} />
      <IconButton
        label="Tìm trong bản ghi (Ctrl+F)"
        icon={<MagnifyingGlass size={18} />}
        aria-pressed={props.searchOpen}
        onClick={props.onSearch}
      />
      <SegmentedControl
        ariaLabel="Chế độ hiển thị"
        options={VIEW_OPTIONS}
        value={props.view}
        onValueChange={props.onViewChange}
        size="sm"
        variant="tabs"
      />
      {props.action}
    </header>
  );
}
