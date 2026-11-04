"use client";

import { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Banner, Button, Card } from "@recap/admin-ui";
import { InstructionsField } from "@/components/template-fields";
import { TemplateCards } from "@/components/template-cards";
import { TemplateSummary } from "@/components/template-summary";
import { useSettingsDraft, type MeetingSettings } from "@/components/use-settings-draft";

export type { MeetingSettings };

/** Where the settings live (lifted above the language-keyed panel) and how to save them. */
export interface SettingsBinding {
  meetingId: string;
  value: MeetingSettings;
  onSaved: (settings: MeetingSettings) => void;
}

interface MinutesSettingsProps {
  binding: SettingsBinding;
  /** Unsaved minutes edits: saving would reload them away, so the form waits. */
  dirty: boolean;
  busy: boolean;
  /** Re-reads the minutes so the stale banner shows right away. */
  onReload: () => void;
}

/**
 * Smallest edit surface for the minutes type and extra instructions of a meeting. Saving changes
 * the meeting only; existing minutes then show the stale banner (no silent regeneration).
 */
export function MinutesSettings({ binding, dirty, busy, onReload }: MinutesSettingsProps) {
  const { meetingId, value: settings, onSaved } = binding;
  const [open, setOpen] = useState(false);
  return (
    <Card className="mt-3 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <TemplateSummary templateId={settings.templateId} />
        {settings.extraInstructions && (
          <span className="text-xs text-soft-muted">Có hướng dẫn thêm</span>
        )}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Đóng" : "Sửa"}
        </Button>
      </div>
      {open && (
        <SettingsForm
          meetingId={meetingId}
          settings={settings}
          disabled={dirty || busy}
          dirty={dirty}
          onSaved={(next) => {
            setOpen(false);
            onSaved(next);
            onReload();
          }}
        />
      )}
    </Card>
  );
}

interface SettingsFormProps {
  meetingId: string;
  settings: MeetingSettings;
  disabled: boolean;
  dirty: boolean;
  onSaved: (settings: MeetingSettings) => void;
}

function SettingsForm({ meetingId, settings, disabled, dirty, onSaved }: SettingsFormProps) {
  const draft = useSettingsDraft(meetingId, settings, onSaved);
  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-soft-line pt-4">
      {draft.failure && (
        <Banner tone="error" icon={<WarningCircle />}>
          {draft.failure}
        </Banner>
      )}
      <TemplateCards
        value={draft.templateId}
        onChange={draft.setTemplateId}
        disabled={draft.saving}
      />
      <InstructionsField value={draft.instructions} onChange={draft.setInstructions} rows={3} />
      <p className="text-xs text-soft-muted">
        {dirty
          ? "Hãy lưu các chỉnh sửa biên bản trước khi đổi loại cuộc họp."
          : "Biên bản hiện có sẽ báo cần cập nhật; bấm Tạo lại để áp dụng."}
      </p>
      <div>
        <Button
          size="sm"
          loading={draft.saving}
          disabled={disabled}
          onClick={() => void draft.save()}
        >
          Lưu thay đổi
        </Button>
      </div>
    </div>
  );
}
