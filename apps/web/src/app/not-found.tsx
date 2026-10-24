import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { ActionGroup, buttonVariants, EmptyState } from "@recap/admin-ui";
import { StandalonePage } from "@/components/standalone-page";

export default function NotFound() {
  return (
    <StandalonePage>
      <EmptyState
        icon={<MagnifyingGlass />}
        title="Không tìm thấy trang này"
        description="Đường dẫn có thể sai hoặc nội dung đã bị xóa."
        action={
          <ActionGroup placement="center">
            <Link href="/" className={buttonVariants({ variant: "primary" })}>
              Về trang chủ
            </Link>
            <Link href="/meetings" className={buttonVariants({ variant: "ghost" })}>
              Danh sách cuộc họp
            </Link>
          </ActionGroup>
        }
      />
    </StandalonePage>
  );
}
