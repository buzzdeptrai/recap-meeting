"use client";

import {
  ArrowSquareOut,
  DotsThree,
  DownloadSimple,
  FileText,
  LinkSimple,
  MagicWand,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  IconButton,
  Tooltip,
  iconButtonVariants,
  type DropdownItem,
} from "@recap/admin-ui";
import Link from "next/link";
import type { MeetingListItemDto } from "@/lib/api-types";
import {
  exportAvailability,
  exportHref,
  minutesAction,
  minutesHref,
  roomHref,
} from "./meeting-format";

const EXPORTS = [
  { lang: "vi", label: "Tiếng Việt" },
  { lang: "en", label: "English" },
  { lang: "both", label: "Song ngữ" },
] as const;

const MISSING_HINT = "chưa có biên bản";

function exportItems(meeting: MeetingListItemDto): DropdownItem[] {
  const available = exportAvailability(meeting);
  return EXPORTS.map(({ lang, label }) => {
    const ok = available[lang];
    return {
      id: `export-${lang}`,
      icon: <DownloadSimple />,
      disabled: !ok,
      href: ok ? exportHref(meeting.id, lang) : undefined,
      label: (
        <span className="flex flex-col leading-tight">
          <span>Xuất Word · {label}</span>
          {ok ? null : (
            <span className="text-[11px] font-medium text-soft-muted">
              {lang === "both"
                ? "cần cả biên bản VI và EN"
                : `${MISSING_HINT} ${lang.toUpperCase()}`}
            </span>
          )}
        </span>
      ),
    };
  });
}

/** Menu entries shared by the "⋯" menu (cards) and, minus the export block, the hover cluster. */
export function moreItems(
  meeting: MeetingListItemDto,
  onCopy: (id: string) => void,
): DropdownItem[] {
  return [
    {
      id: "copy",
      label: "Sao chép liên kết",
      icon: <LinkSimple />,
      onSelect: () => onCopy(meeting.id),
    },
  ];
}

function fullItems(meeting: MeetingListItemDto, onCopy: (id: string) => void): DropdownItem[] {
  const action = minutesAction(meeting);
  const minutes: DropdownItem[] =
    action === "unavailable"
      ? [
          {
            id: "minutes",
            label: "Biên bản (chỉ khi cuộc họp đã kết thúc)",
            icon: <FileText />,
            disabled: true,
          },
        ]
      : [
          {
            id: "minutes",
            label: action === "open" ? "Biên bản" : "Tạo biên bản",
            icon: action === "open" ? <FileText /> : <MagicWand />,
            href: minutesHref(meeting.id),
          },
        ];
  return [
    { id: "room", label: "Mở phòng", icon: <ArrowSquareOut />, href: roomHref(meeting.id) },
    ...minutes,
    ...exportItems(meeting),
    ...moreItems(meeting, onCopy),
  ];
}

interface ActionProps {
  meeting: MeetingListItemDto;
  onCopy: (id: string) => void;
}

/** Complete "⋯" menu for stacked cards (touch friendly, always visible). */
export function MoreMenu({ meeting, onCopy }: ActionProps) {
  return (
    <DropdownMenu
      items={fullItems(meeting, onCopy)}
      trigger={
        <IconButton
          label="Thao tác"
          icon={<DotsThree size={20} weight="bold" />}
          className="relative z-10"
        />
      }
    />
  );
}

/**
 * Hover/focus cluster of the table row: Mở phòng, Biên bản (or Tạo biên bản), Xuất Word, "⋯".
 * Sits above the row's stretched link; on touch devices only "⋯" shows.
 */
export function ActionCluster({ meeting, onCopy }: ActionProps) {
  const action = minutesAction(meeting);
  return (
    <div className="flex items-center gap-1">
      <span className="flex items-center gap-1 [@media(hover:none)]:hidden">
        <Tooltip content="Mở phòng">
          <Link
            href={roomHref(meeting.id)}
            aria-label="Mở phòng"
            className={iconButtonVariants({ size: "sm" })}
          >
            <ArrowSquareOut size={18} />
          </Link>
        </Tooltip>
        <MinutesButton meeting={meeting} action={action} />
        <ExportMenu meeting={meeting} />
      </span>
      <DropdownMenu
        items={[
          { id: "room", label: "Mở phòng", icon: <ArrowSquareOut />, href: roomHref(meeting.id) },
          ...(action === "unavailable"
            ? []
            : [
                {
                  id: "minutes",
                  label: action === "open" ? "Biên bản" : "Tạo biên bản",
                  icon: <FileText />,
                  href: minutesHref(meeting.id),
                },
              ]),
          ...moreItems(meeting, onCopy),
        ]}
        trigger={<IconButton label="Thêm thao tác" icon={<DotsThree size={20} weight="bold" />} />}
      />
    </div>
  );
}

function MinutesButton({
  meeting,
  action,
}: {
  meeting: MeetingListItemDto;
  action: ReturnType<typeof minutesAction>;
}) {
  if (action === "unavailable") {
    return (
      <Tooltip content="Chỉ lập biên bản được khi cuộc họp đã kết thúc">
        <span
          className={iconButtonVariants({ size: "sm" }) + " cursor-not-allowed opacity-40"}
          role="img"
          aria-label="Biên bản chưa khả dụng"
        >
          <FileText size={18} />
        </span>
      </Tooltip>
    );
  }
  const create = action === "create";
  return (
    <Tooltip content={create ? "Tạo biên bản" : "Biên bản"}>
      <Link
        href={minutesHref(meeting.id)}
        aria-label={create ? "Tạo biên bản" : "Biên bản"}
        className={iconButtonVariants({ size: "sm" })}
      >
        {create ? <MagicWand size={18} /> : <FileText size={18} />}
      </Link>
    </Tooltip>
  );
}

function ExportMenu({ meeting }: { meeting: MeetingListItemDto }) {
  const none = !exportAvailability(meeting).vi && !exportAvailability(meeting).en;
  return (
    <DropdownMenu
      items={exportItems(meeting)}
      trigger={
        <IconButton
          label={none ? "Xuất Word (chưa có biên bản)" : "Xuất Word"}
          icon={<DownloadSimple size={18} />}
          aria-disabled={none || undefined}
          className={none ? "opacity-50" : undefined}
        />
      }
    />
  );
}
