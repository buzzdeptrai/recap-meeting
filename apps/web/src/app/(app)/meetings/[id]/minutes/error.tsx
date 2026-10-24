"use client";

import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react";
import { ActionGroup, Button, buttonVariants, Card, EmptyState } from "@recap/admin-ui";

export default function MinutesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card as="section" aria-label="Lỗi">
      <EmptyState
        icon={<WarningCircle />}
        tone="red"
        title="Không tải được biên bản"
        description="Có lỗi khi đọc dữ liệu cuộc họp. Kiểm tra máy chủ đang chạy rồi thử lại."
        action={
          <ActionGroup placement="center">
            <Button onClick={reset}>Thử lại</Button>
            <Link href="/" className={buttonVariants({ variant: "ghost" })}>
              Về trang chủ
            </Link>
          </ActionGroup>
        }
      />
    </Card>
  );
}
