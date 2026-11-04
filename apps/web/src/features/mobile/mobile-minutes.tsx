"use client";

import { useState } from "react";
import Link from "next/link";
import { FileDoc, WarningCircle } from "@phosphor-icons/react";
import {
  Banner,
  Button,
  buttonVariants,
  Card,
  SegmentedControl,
  type SegmentOption,
} from "@recap/admin-ui";
import type { MinutesContent, MinutesLang } from "@recap/core";
import { StatusBadge } from "@/components/status-badge";
import { TOPIC_STATUS } from "@/lib/status";
import { exportHref } from "../minutes/export-options";
import { DEFAULT_SOURCE_LANG, MINUTES_LANG_ORDER, langTitle } from "../minutes/minutes-langs";
import { GeneratingMinutes, LoadingMinutes } from "../minutes/minutes-states";
import { SourceLangPicker } from "../minutes/source-lang-picker";
import { useMinutes } from "../minutes/use-minutes";
import {
  CREATE_MINUTES_LABEL,
  EXPORT_WORD_LABEL,
  MINUTES_EMPTY,
  MINUTES_TITLE,
  OPEN_FULL_MINUTES_LABEL,
} from "./mobile-copy";

const BIG_BUTTON = "h-14 w-full text-base";
const LANG_OPTIONS: ReadonlyArray<SegmentOption<MinutesLang>> = MINUTES_LANG_ORDER.map((lang) => ({
  value: lang,
  label: langTitle(lang),
}));

interface MobileMinutesProps {
  meetingId: string;
  /** Language the speakers used, to pre-select the minutes language. */
  sourceLang: string | null;
}

/** First guess of the minutes language: Vietnamese meetings get Vietnamese minutes first. */
export const initialMinutesLang = (sourceLang: string | null): MinutesLang =>
  sourceLang === "vi" ? "vi" : DEFAULT_SOURCE_LANG;

/** After stopping: create the minutes (background run, polled), read them, download Word. */
export function MobileMinutes({ meetingId, sourceLang }: MobileMinutesProps) {
  const [lang, setLang] = useState<MinutesLang>(() => initialMinutesLang(sourceLang));
  // Remounted per language so the hook never mixes two languages' state.
  return <MinutesPanel key={lang} meetingId={meetingId} lang={lang} onLangChange={setLang} />;
}

interface MinutesPanelProps {
  meetingId: string;
  lang: MinutesLang;
  onLangChange: (lang: MinutesLang) => void;
}

function MinutesPanel({ meetingId, lang, onLangChange }: MinutesPanelProps) {
  const minutes = useMinutes(meetingId, lang, onLangChange);
  const { phase, failure, content } = minutes;
  const showSwitch = phase === "ready" || phase === "generating";
  return (
    <section aria-label={MINUTES_TITLE} className="flex flex-col gap-3">
      {failure && (
        <Banner tone="error" icon={<WarningCircle />} onDismiss={minutes.dismissFailure}>
          {failure.message}
        </Banner>
      )}
      {showSwitch && (
        <SegmentedControl
          ariaLabel="Ngôn ngữ biên bản"
          options={LANG_OPTIONS}
          value={lang}
          onValueChange={onLangChange}
          fill
        />
      )}
      {phase === "loading" && <LoadingMinutes />}
      {phase === "generating" && <GeneratingMinutes run={minutes.run} />}
      {phase === "load-error" && (
        <Button className={BIG_BUTTON} onClick={minutes.reload}>
          Tải lại
        </Button>
      )}
      {phase === "empty" && (
        <EmptyCard lang={lang} onLangChange={onLangChange} onCreate={minutes.generate} />
      )}
      {phase === "ready" && <ReadyBlock meetingId={meetingId} lang={lang} content={content} />}
      <Link
        href={`/meetings/${meetingId}/minutes`}
        className={buttonVariants({ variant: "outline", className: "h-12 w-full" })}
      >
        {OPEN_FULL_MINUTES_LABEL}
      </Link>
    </section>
  );
}

interface ReadyBlockProps {
  meetingId: string;
  lang: MinutesLang;
  content: MinutesContent;
}

/** Digest plus the Word download (the file of the language shown). */
function ReadyBlock({ meetingId, lang, content }: ReadyBlockProps) {
  return (
    <>
      <MinutesSummary content={content} />
      <a
        href={exportHref(meetingId, lang)}
        className={buttonVariants({ variant: "primary", className: BIG_BUTTON })}
      >
        <FileDoc size={20} />
        {EXPORT_WORD_LABEL}
      </a>
    </>
  );
}

interface EmptyCardProps {
  lang: MinutesLang;
  onLangChange: (lang: MinutesLang) => void;
  onCreate: (lang: MinutesLang) => Promise<void>;
}

/** No minutes yet: pick the language they are written in, then create. */
function EmptyCard({ lang, onLangChange, onCreate }: EmptyCardProps) {
  return (
    <Card>
      <p className="mb-4 text-sm text-soft-muted">{MINUTES_EMPTY}</p>
      <div className="mb-4">
        <SourceLangPicker value={lang} onChange={onLangChange} />
      </div>
      <Button className={BIG_BUTTON} onClick={() => void onCreate(lang)}>
        {CREATE_MINUTES_LABEL}
      </Button>
    </Card>
  );
}

/** Read-only digest: summary, topics with outcome, action items. Editing is on the full page. */
function MinutesSummary({ content }: { content: MinutesContent }) {
  return (
    <Card>
      <p className="text-[15px] leading-snug">{content.summary}</p>
      {content.topics.map((topic) => (
        <article key={topic.id} className="mt-4 border-t border-soft-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-bold">{topic.title}</h3>
            <StatusBadge status={TOPIC_STATUS[topic.status]} />
          </div>
          {topic.conclusion && (
            <p className="mt-1 text-[14px] text-soft-ink">{topic.conclusion.text}</p>
          )}
        </article>
      ))}
      {content.actionItems.length > 0 && (
        <div className="mt-4 border-t border-soft-line pt-3">
          <h3 className="mb-1 text-[15px] font-bold">Việc cần làm</h3>
          <ul className="list-disc pl-5 text-[14px]">
            {content.actionItems.map((item) => (
              <li key={item.id}>
                {item.task}
                {item.owner ? ` · ${item.owner}` : ""}
                {item.due ? ` · ${item.due}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
