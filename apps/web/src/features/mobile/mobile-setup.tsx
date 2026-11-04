"use client";

import { useState } from "react";
import Link from "next/link";
import { Microphone, WarningCircle } from "@phosphor-icons/react";
import { Banner, Button, Field, Input, SegmentedControl } from "@recap/admin-ui";
import {
  DEFAULT_TEMPLATE_ID,
  type MeetingTemplateId,
  type SourceLang,
  type TargetLang,
} from "@recap/core";
import { InstructionsField } from "@/components/template-fields";
import { TemplateCards } from "@/components/template-cards";
import { unlockAudio } from "@/audio/mic-capture";
import { createMeeting } from "@/lib/api";
import type { MeetingDto } from "@/lib/api-types";
import { SOURCE_LANG_OPTIONS, TARGET_LANG_OPTIONS } from "@/lib/format";
import { defaultMeetingTitle } from "./mobile-logic";
import { SETUP_HINT, SETUP_TITLE, START_LABEL } from "./mobile-copy";

interface MobileSetupProps {
  onCreated: (meeting: MeetingDto) => void;
}

function useSetupForm(onCreated: (meeting: MeetingDto) => void) {
  const [title, setTitle] = useState(() => defaultMeetingTitle(new Date()));
  const [sourceLang, setSourceLang] = useState<SourceLang>("multi");
  const [targetLang, setTargetLang] = useState<TargetLang>("vi");
  const [templateId, setTemplateId] = useState<MeetingTemplateId>(DEFAULT_TEMPLATE_ID);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function start() {
    unlockAudio(); // synchronous, inside the tap: iOS only lets audio run if unlocked here
    setBusy(true);
    setFailure(null);
    const body = {
      title: title.trim() || defaultMeetingTitle(new Date()),
      sourceLang,
      targetLang,
      templateId,
      extraInstructions: extraInstructions.trim() || undefined,
    };
    try {
      onCreated(await createMeeting(body));
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Không tạo được cuộc họp.");
      setBusy(false);
    }
  }
  return {
    title,
    setTitle,
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    templateId,
    setTemplateId,
    extraInstructions,
    setExtraInstructions,
    busy,
    failure,
    start,
  };
}

/** First screen: title, spoken language, and one big Start. The tap also unlocks audio for iOS. */
export function MobileSetup({ onCreated }: MobileSetupProps) {
  const form = useSetupForm(onCreated);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div>
        <h1 className="text-xl font-bold">{SETUP_TITLE}</h1>
        <p className="mt-1 text-sm text-soft-muted">{SETUP_HINT}</p>
      </div>
      {form.failure && (
        <Banner tone="error" icon={<WarningCircle />}>
          {form.failure}
        </Banner>
      )}
      <SetupFields form={form} />
      <div className="mt-auto flex flex-col gap-3">
        <Button
          className="h-16 w-full text-base"
          icon={<Microphone size={22} weight="fill" />}
          loading={form.busy}
          onClick={() => void form.start()}
        >
          {START_LABEL}
        </Button>
        <Link href="/meetings" className="py-2 text-center text-sm text-soft-muted underline">
          Về danh sách cuộc họp
        </Link>
      </div>
    </main>
  );
}

function SetupFields({ form }: { form: ReturnType<typeof useSetupForm> }) {
  return (
    <>
      <Field label="Tiêu đề">
        <Input
          value={form.title}
          maxLength={200}
          className="h-12 text-base"
          onChange={(event) => form.setTitle(event.target.value)}
        />
      </Field>
      <Field label="Ngôn ngữ người nói">
        <SegmentedControl
          ariaLabel="Ngôn ngữ người nói"
          options={SOURCE_LANG_OPTIONS}
          value={form.sourceLang}
          onValueChange={form.setSourceLang}
          variant="tabs"
          fill
        />
      </Field>
      <Field label="Dịch sang">
        <SegmentedControl
          ariaLabel="Dịch sang"
          options={TARGET_LANG_OPTIONS}
          value={form.targetLang}
          onValueChange={form.setTargetLang}
          fill
        />
      </Field>
      <TemplateCards value={form.templateId} onChange={form.setTemplateId} compact />
      <InstructionsField
        value={form.extraInstructions}
        onChange={form.setExtraInstructions}
        rows={3}
      />
    </>
  );
}
