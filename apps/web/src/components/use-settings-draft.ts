"use client";

import { useState } from "react";
import { DEFAULT_TEMPLATE_ID, isMeetingTemplateId, type MeetingTemplateId } from "@recap/core";
import { updateMeetingSettings } from "@/lib/api";

export interface MeetingSettings {
  templateId: string;
  extraInstructions: string;
}

export const asTemplate = (id: string): MeetingTemplateId =>
  isMeetingTemplateId(id) ? id : DEFAULT_TEMPLATE_ID;

/** Draft of the meeting type + extra instructions with the PATCH call (shared by the minutes page and the room dialog). */
export function useSettingsDraft(
  meetingId: string,
  settings: MeetingSettings,
  onSaved: (settings: MeetingSettings) => void,
) {
  const [templateId, setTemplateId] = useState(asTemplate(settings.templateId));
  const [instructions, setInstructions] = useState(settings.extraInstructions);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setFailure(null);
    try {
      const meeting = await updateMeetingSettings(meetingId, {
        templateId,
        extraInstructions: instructions.trim() || null,
      });
      onSaved({
        templateId: meeting.templateId,
        extraInstructions: meeting.extraInstructions ?? "",
      });
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Không lưu được thay đổi.");
      setSaving(false);
    }
  }

  return { templateId, setTemplateId, instructions, setInstructions, saving, failure, save };
}
