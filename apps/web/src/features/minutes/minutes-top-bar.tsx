import { ArrowLeft, ArrowsClockwise, FloppyDisk } from "@phosphor-icons/react";
import Link from "next/link";
import type { MinutesLang } from "@recap/core";
import {
  ActionGroup,
  Button,
  iconButtonVariants,
  SegmentedControl,
  Tooltip,
  type SegmentOption,
} from "@recap/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { MINUTES_SOURCE, UNSAVED_STATUS } from "@/lib/status";
import type { MinutesDto } from "@/lib/api-types";
import { formatClock, formatDateTime } from "@/lib/format";
import { ExportMenu } from "./export-menu";
import type { MinutesAvailability } from "./export-options";
import { formatSavedTime } from "./format";

const LANG_OPTIONS: ReadonlyArray<SegmentOption<MinutesLang>> = [
  { value: "vi", label: "VI" },
  { value: "en", label: "EN" },
];

export interface MinutesMeetingInfo {
  id: string;
  title: string;
  startedAt: string;
  durationMs: number | null;
  ended: boolean;
}

interface MinutesTopBarProps {
  meeting: MinutesMeetingInfo;
  lang: MinutesLang;
  onLangChange: (lang: MinutesLang) => void;
  saved: MinutesDto | null;
  dirty: boolean;
  saving: boolean;
  busy: boolean;
  available: MinutesAvailability;
  onSave: () => void;
  onRegenerate: () => void;
}

export function MinutesTopBar({ meeting, lang, onLangChange, saved, ...rest }: MinutesTopBarProps) {
  return (
    <header className="z-[5] rounded-soft bg-soft-surface shadow-soft-sm min-[861px]:sticky min-[861px]:top-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <Link
          href={`/meetings/${meeting.id}`}
          aria-label="Về bản ghi cuộc họp"
          className={iconButtonVariants()}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="truncate text-[15px] font-bold">{meeting.title}</h1>
          <p className="font-soft-mono text-xs text-soft-muted">
            {formatDateTime(meeting.startedAt)}
            {meeting.durationMs !== null && ` · ${formatClock(meeting.durationMs)}`}
          </p>
        </div>
        <SegmentedControl
          ariaLabel="Ngôn ngữ biên bản"
          options={LANG_OPTIONS}
          value={lang}
          onValueChange={onLangChange}
          size="sm"
        />
        {saved && <SaveCluster saved={saved} meetingId={meeting.id} {...rest} />}
      </div>
    </header>
  );
}

type ClusterProps = Omit<MinutesTopBarProps, "meeting" | "lang" | "onLangChange" | "saved"> & {
  saved: MinutesDto;
  meetingId: string;
};

function SaveCluster(props: ClusterProps) {
  const { saved, meetingId, dirty, saving, busy, available, onSave, onRegenerate } = props;
  return (
    <ActionGroup className="max-[640px]:w-full max-[640px]:[&>*:last-child]:flex-1">
      <span
        className="mr-1 flex items-center gap-2 text-xs text-soft-muted max-[640px]:w-full"
        aria-live="polite"
      >
        {dirty ? (
          <StatusBadge status={UNSAVED_STATUS} />
        ) : (
          <>
            Đã lưu {formatSavedTime(saved.updatedAt)}
            <StatusBadge status={MINUTES_SOURCE[saved.source === "ai" ? "ai" : "edited"]} plain />
          </>
        )}
      </span>
      <Button
        size="sm"
        variant="outline"
        icon={<ArrowsClockwise size={14} />}
        onClick={onRegenerate}
        disabled={busy}
      >
        Tạo lại
      </Button>
      <ExportMenu meetingId={meetingId} available={available} dirty={dirty} disabled={busy} />
      <SaveButton dirty={dirty} saving={saving} busy={busy} onSave={onSave} />
    </ActionGroup>
  );
}

interface SaveButtonProps {
  dirty: boolean;
  saving: boolean;
  busy: boolean;
  onSave: () => void;
}

/** The only gradient button in the bar; off until there is something to save, and says so. */
function SaveButton({ dirty, saving, busy, onSave }: SaveButtonProps) {
  const button = (
    <Button
      size="sm"
      icon={<FloppyDisk size={14} />}
      onClick={onSave}
      disabled={!dirty || saving || busy}
      className="max-[640px]:w-full"
    >
      {saving ? "Đang lưu" : "Lưu"}
    </Button>
  );
  if (dirty) return button;
  return (
    <Tooltip content="Chưa có thay đổi để lưu">
      <span tabIndex={0} className="inline-flex rounded-[10px] max-[640px]:flex-1">
        {button}
      </span>
    </Tooltip>
  );
}
