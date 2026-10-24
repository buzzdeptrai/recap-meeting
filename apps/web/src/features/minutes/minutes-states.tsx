"use client";

import { SpinnerGap } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants, Card, EmptyState, Skeleton } from "@recap/admin-ui";

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

/** Seconds since mount, so a 5-60 s wait does not look frozen. */
function useSecondsElapsed(): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return seconds;
}

export function GeneratingMinutes() {
  const seconds = useSecondsElapsed();
  return (
    <Card>
      <div role="status" className="mx-auto max-w-xl py-6">
        <div className="flex items-center gap-3">
          <SpinnerGap
            size={20}
            className="animate-spin text-soft-purple motion-reduce:animate-none"
          />
          <h2 className="text-base font-bold">Đang lập biên bản</h2>
          <span className="font-soft-mono text-[13px] tabular-nums text-soft-muted">
            {seconds}s
          </span>
        </div>
        <p className="mt-2 text-[13px] text-soft-muted">
          Việc này thường mất từ 5 đến 60 giây tùy độ dài cuộc họp. Bạn có thể giữ trang này mở.
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
