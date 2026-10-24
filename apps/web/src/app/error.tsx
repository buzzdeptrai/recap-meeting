"use client";

import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react";
import { ActionGroup, Button, buttonVariants, EmptyState } from "@recap/admin-ui";
import { StandalonePage } from "@/components/standalone-page";

/** Failure outside the shell (e.g. the database cannot be opened): say what happened and offer a way out. */
export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StandalonePage>
      <EmptyState
        icon={<WarningCircle />}
        tone="red"
        title="Không tải được trang này"
        description="Có lỗi khi đọc dữ liệu cuộc họp. Kiểm tra máy chủ đang chạy (npm run dev) rồi thử lại."
        action={
          <ActionGroup placement="center">
            <Button onClick={reset}>Thử lại</Button>
            <Link href="/" className={buttonVariants({ variant: "ghost" })}>
              Về trang chủ
            </Link>
          </ActionGroup>
        }
      />
    </StandalonePage>
  );
}
