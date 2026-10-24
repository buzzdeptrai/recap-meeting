"use client";

import {
  ArrowSquareOut,
  DotsThree,
  FileDoc,
  FileMd,
  FileText,
  LinkSimple,
  MagicWand,
  Trash,
} from "@phosphor-icons/react";
import { DropdownMenu, IconButton, buttonVariants, type DropdownItem } from "@recap/admin-ui";
import Link from "next/link";
import {
  exportOptions,
  hasAnyMinutes,
  type ExportFormat,
  type ExportOption,
} from "@/features/minutes/export-options";
import type { MeetingListItemDto } from "@/lib/api-types";
import {
  minutesAction,
  minutesAvailability,
  minutesHref,
  quickAction,
  roomHref,
} from "./meeting-format";
import { deleteBlockedReason } from "./trash-logic";

const FORMAT_NAME: Record<ExportFormat, string> = { docx: "Word", md: "Markdown" };
const NO_MINUTES_REASON = "Chưa có biên bản";
const LIVE_REASON = "Chỉ tạo được khi cuộc họp đã kết thúc";

function exportItem(option: ExportOption): DropdownItem {
  const Icon = option.format === "md" ? FileMd : FileDoc;
  return {
    id: `${option.format}-${option.mode}`,
    icon: <Icon />,
    disabled: !option.enabled,
    href: option.enabled ? option.href : undefined,
    label: (
      <span className="flex flex-col leading-tight">
        <span>{`Xuất ${FORMAT_NAME[option.format]} · ${option.label}`}</span>
        {option.reason ? (
          <span className="text-[11px] font-medium text-soft-muted">{option.reason}</span>
        ) : null}
      </span>
    ),
  };
}

/** Word and Markdown exports; with no minutes at all the six options collapse into one disabled line. */
function exportItems(meeting: MeetingListItemDto): DropdownItem[] {
  const available = minutesAvailability(meeting);
  if (!hasAnyMinutes(available)) {
    return [
      {
        id: "export",
        icon: <FileDoc />,
        disabled: true,
        label: (
          <span className="flex flex-col leading-tight">
            <span>Xuất file</span>
            <span className="text-[11px] font-medium text-soft-muted">{NO_MINUTES_REASON}</span>
          </span>
        ),
      },
    ];
  }
  return (["docx", "md"] as const).flatMap((format) =>
    exportOptions(meeting.id, available, format).map(exportItem),
  );
}

function minutesItem(meeting: MeetingListItemDto): DropdownItem {
  const action = minutesAction(meeting);
  if (action === "unavailable") {
    return {
      id: "minutes",
      icon: <FileText />,
      disabled: true,
      label: (
        <span className="flex flex-col leading-tight">
          <span>Biên bản</span>
          <span className="text-[11px] font-medium text-soft-muted">{LIVE_REASON}</span>
        </span>
      ),
    };
  }
  return {
    id: "minutes",
    icon: action === "open" ? <FileText /> : <MagicWand />,
    label: action === "open" ? "Mở biên bản" : "Tạo biên bản",
    href: minutesHref(meeting.id),
  };
}

/** Everything a row can do, in one place: open, minutes, exports, copy link. Delete has its own icon button. */
export function menuItems(
  meeting: MeetingListItemDto,
  onCopy: (id: string) => void,
): DropdownItem[] {
  return [
    { id: "room", label: "Mở phòng", icon: <ArrowSquareOut />, href: roomHref(meeting.id) },
    minutesItem(meeting),
    ...exportItems(meeting),
    {
      id: "copy",
      label: "Sao chép liên kết",
      icon: <LinkSimple />,
      onSelect: () => onCopy(meeting.id),
    },
  ];
}

interface ActionProps {
  meeting: MeetingListItemDto;
  onCopy: (id: string) => void;
  onDelete: (meeting: MeetingListItemDto) => void;
}

/** Soft delete trigger; disabled (with the reason as tooltip) while the meeting is live. */
function DeleteButton({ meeting, onDelete }: Pick<ActionProps, "meeting" | "onDelete">) {
  const blocked = deleteBlockedReason(meeting);
  return (
    <IconButton
      label={blocked ?? `Xóa cuộc họp “${meeting.title}”`}
      icon={<Trash size={18} />}
      disabled={blocked !== null}
      onClick={() => onDelete(meeting)}
      className="rounded-full hover:text-soft-danger-ink [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:none)]:size-10"
    />
  );
}

/** One visible quick action (hover/focus on pointer devices, always on touch) plus the "⋯" menu. */
export function RowActions({ meeting, onCopy, onDelete }: ActionProps) {
  const quick = quickAction(meeting);
  return (
    <div className="relative z-10 flex items-center gap-1">
      <Link
        href={quick.href}
        className={`${buttonVariants({ variant: "outline", size: "sm", shape: "pill" })} [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:none)]:h-10 [@media(hover:none)]:px-4`}
      >
        {quick.label}
      </Link>
      <DeleteButton meeting={meeting} onDelete={onDelete} />
      <DropdownMenu
        items={menuItems(meeting, onCopy)}
        trigger={
          <IconButton
            label="Thao tác khác"
            icon={<DotsThree size={20} weight="bold" />}
            className="rounded-full [@media(hover:none)]:size-10"
          />
        }
      />
    </div>
  );
}
