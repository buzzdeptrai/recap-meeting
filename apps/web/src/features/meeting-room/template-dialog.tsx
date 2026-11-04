"use client";

import { useState } from "react";
import { Button, Dialog } from "@recap/admin-ui";
import { TemplateCards } from "@/components/template-cards";
import { InstructionsField } from "@/components/template-fields";
import { TemplateTag } from "@/components/template-tag";
import { useSettingsDraft, type MeetingSettings } from "@/components/use-settings-draft";

interface TemplateChipProps {
  meetingId: string;
  templateId: string;
  extraInstructions: string | null;
}

/** The meeting type chip in the room header; opens a dialog to change the type (live or ended). */
export function TemplateChip({ meetingId, templateId, extraInstructions }: TemplateChipProps) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<MeetingSettings>({
    templateId,
    extraInstructions: extraInstructions ?? "",
  });
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label="Đổi loại cuộc họp"
        onClick={() => setOpen(true)}
        className="soft-focus cursor-pointer rounded-soft-pill hover:opacity-80"
      >
        <TemplateTag templateId={saved.templateId} collapse />
      </button>
      {open && (
        <TemplateDialog
          meetingId={meetingId}
          settings={saved}
          onClose={() => setOpen(false)}
          onSaved={(next) => {
            setSaved(next);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

interface TemplateDialogProps {
  meetingId: string;
  settings: MeetingSettings;
  onClose: () => void;
  onSaved: (settings: MeetingSettings) => void;
}

function TemplateDialog({ meetingId, settings, onClose, onSaved }: TemplateDialogProps) {
  const draft = useSettingsDraft(meetingId, settings, onSaved);
  return (
    <Dialog
      open
      size="lg"
      title="Loại cuộc họp"
      description="Biên bản sẽ nhấn mạnh theo loại bạn chọn. Biên bản đã có chỉ báo cần cập nhật, không tự tạo lại."
      busy={draft.saving}
      error={draft.failure}
      onOpenChange={(next) => !next && onClose()}
      className="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" disabled={draft.saving} onClick={onClose}>
            Hủy
          </Button>
          <Button loading={draft.saving} onClick={() => void draft.save()}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TemplateCards
          value={draft.templateId}
          onChange={draft.setTemplateId}
          disabled={draft.saving}
        />
        <InstructionsField value={draft.instructions} onChange={draft.setInstructions} rows={3} />
      </div>
    </Dialog>
  );
}
