import {
  FileText,
  Flag,
  ListBullets,
  Microphone,
  NotePencil,
  TextAlignLeft,
  Waveform,
} from "@phosphor-icons/react/dist/ssr";
import { Chip, IconBadge, Tooltip, formatNumber, type IconBadgeProps } from "@recap/admin-ui";
import type { ReactNode } from "react";
import type { MeetingListItemDto } from "@/lib/api-types";
import { MEETING_STATUS } from "@/lib/status";
import { Snippet } from "./snippet";
import {
  chipToneFor,
  durationLabel,
  hasMinutes,
  minutesChips,
  subLine,
  wallClockRange,
} from "./meeting-format";

function Counter({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <Tooltip content={label}>
      <span className="soft-tabular inline-flex cursor-default items-center gap-1 text-xs font-semibold text-soft-muted">
        {icon}
        {value}
        <span className="sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}

/** Topics, marked conclusions, words: tiny icons with tooltips. Amber only on the conclusion icon. */
export function Counters({ meeting }: { meeting: MeetingListItemDto }) {
  return (
    <span className="flex items-center gap-3">
      <Counter
        icon={<ListBullets size={14} aria-hidden />}
        value={formatNumber(meeting.topicCount)}
        label={`${formatNumber(meeting.topicCount)} chủ đề`}
      />
      <Counter
        icon={<Flag size={14} weight="fill" aria-hidden className="text-soft-conclusion" />}
        value={formatNumber(meeting.conclusionCount)}
        label={`${formatNumber(meeting.conclusionCount)} kết luận đã đánh dấu`}
      />
      <Counter
        icon={<TextAlignLeft size={14} aria-hidden />}
        value={formatNumber(meeting.wordCount)}
        label={`${formatNumber(meeting.wordCount)} từ`}
      />
    </span>
  );
}

const MINUTES_LANG_NAME = { vi: "Tiếng Việt", en: "English" } as const;

/** Just "Có" / "Chưa" (the languages are in the tooltip); "—" while the meeting is not finished. */
export function MinutesPresence({ meeting }: { meeting: MeetingListItemDto }) {
  if (!hasMinutes(meeting)) {
    return (
      <span className="text-xs text-soft-muted">{meeting.status === "ended" ? "Chưa" : "—"}</span>
    );
  }
  const langs = minutesChips(meeting)
    .map((chip) => MINUTES_LANG_NAME[chip.lang])
    .join(", ");
  return (
    <Tooltip content={`Biên bản: ${langs}`}>
      <span className="cursor-default">
        <Chip tone="ok" size="sm">
          Có
        </Chip>
      </span>
    </Tooltip>
  );
}

/** Duration (mono) with the wall-clock range in a tooltip. */
export function DurationCell({ meeting }: { meeting: MeetingListItemDto }) {
  const wall = wallClockRange(meeting);
  const text = (
    <span className="font-soft-mono text-xs text-soft-muted">{durationLabel(meeting)}</span>
  );
  if (!wall) return text;
  return (
    <Tooltip content={`Đồng hồ: ${wall}`}>{<span className="cursor-default">{text}</span>}</Tooltip>
  );
}

const ICON_PROPS = { size: 18, weight: "regular" } as const;

/** Round leading icon: the kind of meeting at a glance (draft, live, with minutes, recorded). */
export function MeetingIcon({ meeting }: { meeting: MeetingListItemDto }) {
  const tone: NonNullable<IconBadgeProps["tone"]> =
    meeting.status === "live" ? "tone-b" : hasMinutes(meeting) ? "tone-a" : "neutral";
  return (
    <IconBadge tone={tone} size="lg">
      {meeting.status === "draft" ? <NotePencil {...ICON_PROPS} /> : null}
      {meeting.status === "live" ? <Microphone {...ICON_PROPS} /> : null}
      {meeting.status === "ended" && hasMinutes(meeting) ? <FileText {...ICON_PROPS} /> : null}
      {meeting.status === "ended" && !hasMinutes(meeting) ? <Waveform {...ICON_PROPS} /> : null}
    </IconBadge>
  );
}

/** Meeting status as a pill chip: label and tone come from `lib/status.ts`; the live dot pulses (unless reduced motion). */
export function MeetingStatusBadge({ meeting }: { meeting: MeetingListItemDto }) {
  const spec = MEETING_STATUS[meeting.status];
  const dotClass = meeting.status === "live" ? "motion-safe:animate-pulse" : undefined;
  return (
    <Chip
      tone={chipToneFor(spec.tone)}
      size="lg"
      icon={<span className={`size-1.5 rounded-full bg-current ${dotClass ?? ""}`} />}
    >
      {spec.label}
    </Chip>
  );
}

/** Muted one-line summary under the title. */
export function SubLine({ meeting }: { meeting: MeetingListItemDto }) {
  const line = subLine(meeting);
  if (!line) return null;
  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-soft-muted">
      {line.kind === "conclusion" ? (
        <Flag
          size={12}
          weight="fill"
          aria-label="Kết luận"
          className="shrink-0 text-soft-conclusion"
        />
      ) : null}
      <span className="truncate">
        {line.kind === "snippet" ? <Snippet snippet={line.text} /> : line.text}
      </span>
    </span>
  );
}
