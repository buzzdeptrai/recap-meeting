"use client";

import type { ComponentProps } from "react";
import { CaretDown, FileDoc, FileMd } from "@phosphor-icons/react";
import { Button, DropdownMenu, Tooltip, type DropdownItem } from "@recap/admin-ui";
import {
  exportOptions,
  hasAnyMinutes,
  type ExportFormat,
  type ExportOption,
  type MinutesAvailability,
} from "./export-options";

const NO_MINUTES_HINT = "Tạo biên bản trước khi xuất file.";
const UNSAVED_HINT = "Có thay đổi chưa lưu. File xuất là bản đã lưu.";

interface ExportMenuProps {
  meetingId: string;
  available: MinutesAvailability;
  /** Unsaved edits exist: the file will not contain them. */
  dirty: boolean;
  disabled?: boolean;
}

const FORMAT_NAME: Record<ExportFormat, string> = { docx: "Word", md: "Markdown" };

function toItem(option: ExportOption): DropdownItem {
  const Icon = option.format === "md" ? FileMd : FileDoc;
  return {
    id: `${option.format}-${option.mode}`,
    href: option.enabled ? option.href : undefined,
    disabled: !option.enabled,
    icon: <Icon size={16} />,
    label: (
      <span className="flex flex-col">
        <span>{`${FORMAT_NAME[option.format]} · ${option.label}`}</span>
        {option.reason ? (
          <span className="text-[11px] font-normal text-soft-muted">{option.reason}</span>
        ) : null}
      </span>
    ),
  };
}

function Trigger(props: ComponentProps<typeof Button>) {
  return (
    <Button size="sm" variant="outline" icon={<FileDoc size={14} />} {...props}>
      Xuất file
      <CaretDown size={12} weight="bold" />
    </Button>
  );
}

/** One outline button with a menu of Word and Markdown exports; options without minutes say why they are off. */
export function ExportMenu({ meetingId, available, dirty, disabled }: ExportMenuProps) {
  if (!hasAnyMinutes(available) || disabled) {
    return (
      <Tooltip content={NO_MINUTES_HINT}>
        <span tabIndex={0} className="inline-flex rounded-[10px]">
          <Trigger disabled />
        </span>
      </Tooltip>
    );
  }
  return (
    <DropdownMenu
      trigger={<Trigger />}
      header={dirty ? UNSAVED_HINT : undefined}
      items={[
        ...exportOptions(meetingId, available, "docx"),
        ...exportOptions(meetingId, available, "md"),
      ].map(toItem)}
    />
  );
}
