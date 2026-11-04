"use client";

import {
  HIDDEN_TEMPLATE_IDS,
  MEETING_TEMPLATES,
  isMeetingTemplateId,
  type MeetingTemplateId,
} from "@recap/core";
import { OptionCardGroup, type OptionCardItem } from "@recap/admin-ui";
import { TemplateIcon } from "./template-icons";

const FIELD_LABEL = "Loại cuộc họp";

function buildItems(): Array<OptionCardItem<MeetingTemplateId>> {
  return MEETING_TEMPLATES.map((t) => {
    return {
      value: t.id,
      title: t.label,
      description: t.tagline,
      icon: <TemplateIcon id={t.id} size={20} />,
      children: (
        <>
          <ul className="list-disc space-y-0.5 pl-4 marker:text-soft-brand">
            {t.focus.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <span className="mt-2 block text-soft-muted">
            <span className="font-semibold text-soft-ink">Nên chọn khi: </span>
            {t.bestFor}
          </span>
        </>
      ),
    };
  });
}

const ITEMS = buildItems();

/** Hidden types are not offered, except the one the meeting already has (so it stays visible). */
const itemsFor = (current: MeetingTemplateId) =>
  ITEMS.filter((item) => item.value === current || !HIDDEN_TEMPLATE_IDS.includes(item.value));

interface TemplateCardsProps {
  value: MeetingTemplateId;
  onChange: (id: MeetingTemplateId) => void;
  disabled?: boolean;
  /** Single column and tighter padding (phone setup page). */
  compact?: boolean;
  className?: string;
}

/** Meeting type picker as a grid of selectable cards; the selected one lists what the minutes emphasise. */
export function TemplateCards({
  value,
  onChange,
  disabled,
  compact,
  className,
}: TemplateCardsProps) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-[13px] font-semibold text-soft-ink">{FIELD_LABEL}</p>
      <OptionCardGroup
        ariaLabel={FIELD_LABEL}
        items={itemsFor(value)}
        value={value}
        disabled={disabled}
        compact={compact}
        onValueChange={(next) => isMeetingTemplateId(next) && onChange(next)}
      />
    </div>
  );
}
