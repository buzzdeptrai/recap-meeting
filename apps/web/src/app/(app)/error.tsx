"use client";

import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react";
import { ActionGroup, Button, buttonVariants, Card, EmptyState } from "@recap/admin-ui";

/** Failure inside the shell (database unreadable, ...): the sidebar stays usable. */
export default function ShellError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card as="section" aria-label="Lỗi">
      <EmptyState
        icon={<WarningCircle />}
        tone="red"
        title="Không tải được trang này"
        description="Có lỗi khi đọc dữ liệu. Kiểm tra máy chủ đang chạy (npm run dev) rồi thử lại."
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
