"use client";

import { SpinnerGap } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ActionGroup,
  Button,
  buttonVariants,
  Card,
  EmptyState,
  ProgressBar,
  Skeleton,
} from "@recap/admin-ui";
import type { MinutesRunDto } from "@/lib/api-types";
import type { MinutesLang } from "@recap/core";
import { DEFAULT_SOURCE_LANG, langName } from "./minutes-langs";
import { isTranslateRun, runProgressView } from "./run-progress";
import { SourceLangPicker } from "./source-lang-picker";

interface EmptyMinutesProps {
  meetingId: string;
  ended: boolean;
  /** Generate the source minutes in this language (the other one is translated after). */
  onGenerate: (sourceLang: MinutesLang) => void;
  /** The other language that already has minutes, to translate this tab from (null = none). */
  translateFrom: MinutesLang | null;
  onTranslate: () => void;
}

export function EmptyMinutes({
  meetingId,
  ended,
  onGenerate,
  translateFrom,
  onTranslate,
}: EmptyMinutesProps) {
  const [sourceLang, setSourceLang] = useState<MinutesLang>(DEFAULT_SOURCE_LANG);
  if (!ended) {
    return (
      <Card>
        <EmptyState
          title="Cuộc họp chưa kết thúc"
          description="Biên bản được lập từ bản ghi đầy đủ, nên cần dừng ghi trước."
          action={
            <Link
              href={`/meetings/${meetingId}`}
              className={buttonVariants({ variant: "primary" })}
            >
              Về phòng họp
            </Link>
          }
        />
      </Card>
    );
  }
  return (
    <Card>
      <EmptyState
        title="Chưa có biên bản"
        description="Lập biên bản từ bản ghi và các kết luận bạn đã đánh dấu: tóm tắt, chủ đề, việc cần làm, vấn đề còn mở. Bạn sửa lại được sau khi tạo."
        action={
          <div className="flex flex-col items-center gap-4">
            <SourceLangPicker value={sourceLang} onChange={setSourceLang} />
            <ActionGroup>
              <Button onClick={() => onGenerate(sourceLang)}>Tạo biên bản</Button>
              {translateFrom && (
                <Button variant="outline" onClick={onTranslate}>
                  {`Dịch từ bản ${langName(translateFrom)}`}
                </Button>
              )}
            </ActionGroup>
          </div>
        }
      />
    </Card>
  );
}

/** Seconds since mount, so a long run does not look frozen. */
function useSecondsElapsed(): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return seconds;
}

/**
 * Progress of a background run, read from the server (no cost or token numbers here).
 * `run` is null for the instant between the click and the first answer.
 */
export function GeneratingMinutes({ run }: { run: MinutesRunDto | null }) {
  const seconds = useSecondsElapsed();
  const { label, step, steps, percent } = runProgressView(run);
  const translating = isTranslateRun(run);
  return (
    <Card>
      <div role="status" className="mx-auto max-w-xl py-6">
        <div className="flex items-center gap-3">
          <SpinnerGap
            size={20}
            className="animate-spin text-soft-brand motion-reduce:animate-none"
          />
          <h2 className="text-base font-bold">
            {translating ? label : `Đang tạo biên bản · bước ${step}/${steps}`}
          </h2>
          <span className="font-soft-mono text-[13px] tabular-nums text-soft-muted">
            {seconds}s
          </span>
        </div>
        <ProgressBar value={percent} label={`Tiến độ: ${label}`} className="mt-4" />
        <p className="mt-2 text-[13px] font-semibold">{label}</p>
        <p className="mt-1 text-[13px] text-soft-muted">
          {translating
            ? "Bản gốc vẫn dùng được trong lúc dịch. Bạn có thể rời trang, bản dịch vẫn được tạo."
            : "Cuộc họp dài được xử lý theo từng đoạn nên có thể mất vài phút. Bạn có thể rời trang, biên bản vẫn được tạo và tiến độ sẽ hiện lại khi bạn quay về."}
        </p>
      </div>
    </Card>
  );
}

export function LoadingMinutes() {
  return (
    <div role="status" aria-label="Đang tải biên bản" className="flex flex-col gap-3 py-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-20 rounded-soft" />
      <Skeleton className="h-40 rounded-soft" />
    </div>
  );
}
