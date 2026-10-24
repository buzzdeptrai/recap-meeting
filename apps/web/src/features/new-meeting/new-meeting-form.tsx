"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import type { SourceLang, TargetLang } from "@recap/core";
import Link from "next/link";
import {
  ActionGroup,
  Banner,
  Button,
  Field,
  FloatCard,
  Input,
  SegmentedControl,
  Textarea,
} from "@recap/admin-ui";
import { createMeeting } from "@/lib/api";
import { SOURCE_LANG_OPTIONS, TARGET_LANG_OPTIONS } from "@/lib/format";

function useNewMeetingForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [sourceLang, setSourceLang] = useState<SourceLang>("multi");
  const [targetLang, setTargetLang] = useState<TargetLang>("vi");
  const [agenda, setAgenda] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setTitleError("Nhập tiêu đề để dễ tìm lại cuộc họp.");
    setTitleError(null);
    setFailure(null);
    setSubmitting(true);
    try {
      const meeting = await createMeeting({ title: title.trim(), sourceLang, targetLang, agenda });
      router.push(`/meetings/${meeting.id}`);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Không tạo được cuộc họp.");
      setSubmitting(false);
    }
  }

  return {
    values: { title, sourceLang, targetLang, agenda },
    set: { setTitle, setSourceLang, setTargetLang, setAgenda },
    titleError,
    failure,
    submitting,
    onSubmit,
  };
}

export function NewMeetingForm() {
  const { values, set, titleError, failure, submitting, onSubmit } = useNewMeetingForm();
  return (
    <FloatCard as="section" aria-labelledby="h-new-meeting" padding="lg">
      <h2 id="h-new-meeting" className="text-base font-bold text-soft-ink">
        Thông tin cuộc họp
      </h2>
      <p className="mb-6 text-[13px] text-soft-muted">
        Chỉ cần tiêu đề. Bạn có thể đổi ngôn ngữ và agenda sau trong phòng họp.
      </p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {failure && (
          <Banner tone="error" radius="lg" icon={<WarningCircle />}>
            {failure}
          </Banner>
        )}
        <Field label="Tiêu đề" error={titleError}>
          <Input
            value={values.title}
            autoFocus
            maxLength={200}
            placeholder="Ví dụ: Họp giá quý 4 với nhà cung cấp"
            onChange={(event) => set.setTitle(event.target.value)}
          />
        </Field>
        <LanguageFields
          sourceLang={values.sourceLang}
          targetLang={values.targetLang}
          onSource={set.setSourceLang}
          onTarget={set.setTargetLang}
        />
        <AgendaField value={values.agenda} onChange={set.setAgenda} />
        <ActionGroup placement="start" className="border-t border-soft-line pt-6">
          <Button type="submit" size="lg" shape="pill" loading={submitting}>
            {submitting ? "Đang tạo" : "Tạo và vào phòng họp"}
          </Button>
          <Button asChild variant="ghost" size="lg" shape="pill">
            <Link href="/meetings">Hủy</Link>
          </Button>
        </ActionGroup>
      </form>
    </FloatCard>
  );
}

function AgendaField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return (
    <Field
      label="Agenda"
      optional
      hint="Các nội dung cần bàn. Dùng để tham chiếu khi xem lại biên bản."
    >
      <Textarea value={value} maxLength={5000} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

interface LanguageFieldsProps {
  sourceLang: SourceLang;
  targetLang: TargetLang;
  onSource: (value: SourceLang) => void;
  onTarget: (value: TargetLang) => void;
}

function LanguageFields({ sourceLang, targetLang, onSource, onTarget }: LanguageFieldsProps) {
  return (
    <>
      <GroupField
        label="Ngôn ngữ nói"
        hint="Chọn Lẫn Anh–Việt nếu người nói đổi ngôn ngữ giữa chừng."
      >
        <SegmentedControl
          ariaLabel="Ngôn ngữ nói"
          variant="soft"
          fill
          options={SOURCE_LANG_OPTIONS}
          value={sourceLang}
          onValueChange={onSource}
        />
      </GroupField>
      <GroupField label="Dịch sang">
        <SegmentedControl
          ariaLabel="Dịch sang"
          variant="soft"
          fill
          options={TARGET_LANG_OPTIONS}
          value={targetLang}
          onValueChange={onTarget}
        />
      </GroupField>
    </>
  );
}

function GroupField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-soft-ink">{label}</p>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-soft-muted">{hint}</p> : null}
    </div>
  );
}
