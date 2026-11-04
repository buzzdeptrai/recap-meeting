"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { iconButtonVariants, LevelMeter } from "@recap/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { useLevels, type LevelStore } from "@/audio/level-store";
import { levelToBars, METER_BARS } from "@/audio/levels";
import { formatClock } from "@/lib/format";
import { MEETING_STATUS, RECORDING_STATUS, type RecordingState } from "@/lib/status";

interface MobileHeaderProps {
  title: string;
  status: RecordingState;
  stopped: boolean;
  elapsedMs: number;
  recording: boolean;
  levels: LevelStore;
}

/** Title, status (recording / disconnected / ended), clock and a live mic meter. */
export function MobileHeader({
  title,
  status,
  stopped,
  elapsedMs,
  recording,
  levels,
}: MobileHeaderProps) {
  const [mic] = useLevels(levels);
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-soft-line-strong bg-soft-surface px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
      <Link href="/meetings" aria-label="Về danh sách cuộc họp" className={iconButtonVariants()}>
        <ArrowLeft size={18} />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-bold">{title}</h1>
        <div className="mt-0.5 flex items-center gap-2">
          <StatusBadge status={stopped ? MEETING_STATUS.ended : RECORDING_STATUS[status]} />
          {recording && (
            <span className="font-soft-mono text-xs tabular-nums text-soft-muted">
              {formatClock(elapsedMs)}
            </span>
          )}
        </div>
      </div>
      {recording && (
        <LevelMeter
          label="Mức âm thanh micro"
          value={levelToBars(mic, METER_BARS)}
          bars={METER_BARS}
        />
      )}
    </header>
  );
}
