import { createElement, type ComponentType, type ReactElement } from "react";
import {
  ChalkboardTeacher,
  Handshake,
  Kanban,
  Notebook,
  UserFocus,
} from "@phosphor-icons/react/dist/ssr";
import { DEFAULT_TEMPLATE_ID, type MeetingTemplateId } from "@recap/core";

export type TemplateIconComponent = ComponentType<{ size?: number; "aria-hidden"?: boolean }>;

/** One icon per meeting type; presentation only, so it lives here and not in @recap/core. */
export const TEMPLATE_ICONS: Record<MeetingTemplateId, TemplateIconComponent> = {
  general: Notebook,
  project: Kanban,
  client: Handshake,
  interview: UserFocus,
  training: ChalkboardTeacher,
};

/** Icon for any id (unknown ids fall back to the general meeting icon). */
export function templateIcon(id: string): TemplateIconComponent {
  return id in TEMPLATE_ICONS
    ? TEMPLATE_ICONS[id as MeetingTemplateId]
    : TEMPLATE_ICONS[DEFAULT_TEMPLATE_ID];
}

/** Renders the icon of a meeting type. */
export function TemplateIcon({ id, size = 14 }: { id: string; size?: number }): ReactElement {
  return createElement(templateIcon(id), { size, "aria-hidden": true });
}
