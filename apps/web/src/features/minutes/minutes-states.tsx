"use client";

import { SpinnerGap } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants, Card, EmptyState, ProgressBar, Skeleton } from "@recap/admin-ui";
import type { MinutesRunDto } from "@/lib/api-types";
import { runProgressView } from "./run-progress";

interface EmptyMinutesProps {
  meetingId: string;
  ended: boolean;
  onGenerate: () => void;
}

export function EmptyMinutes({ meetingId, ended, onGenerate }: EmptyMinutesProps) {
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
        title="Chưa có biên bản cho ngôn ngữ này"
        description="Hệ thống đọc toàn bộ bản ghi và các kết luận bạn đã đánh dấu, rồi lập biên bản gồm tóm tắt, chủ đề, việc cần làm và vấn đề còn mở. Bạn có thể sửa lại trước khi lưu."
        action={<Button onClick={onGenerate}>Tạo biên bản</Button>}
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
  return (
    <Card>
      <div role="status" className="mx-auto max-w-xl py-6">
        <div className="flex items-center gap-3">
          <SpinnerGap
            size={20}
            className="animate-spin text-soft-brand motion-reduce:animate-none"
          />
          <h2 className="text-base font-bold">
            Đang tạo biên bản · bước {step}/{steps}
          </h2>
          <span className="font-soft-mono text-[13px] tabular-nums text-soft-muted">
            {seconds}s
          </span>
        </div>
        <ProgressBar value={percent} label={`Tiến độ tạo biên bản: ${label}`} className="mt-4" />
        <p className="mt-2 text-[13px] font-semibold">{label}</p>
        <p className="mt-1 text-[13px] text-soft-muted">
          Cuộc họp dài được xử lý theo từng đoạn nên có thể mất vài phút. Bạn có thể rời trang, biên
          bản vẫn được tạo và tiến độ sẽ hiện lại khi bạn quay về.
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
