import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { ActionGroup, buttonVariants, Card, EmptyState } from "@recap/admin-ui";

/** `notFound()` thrown inside the shell (e.g. an unknown meeting id): the sidebar stays usable. */
export default function ShellNotFound() {
  return (
    <Card as="section" aria-label="Không tìm thấy">
      <EmptyState
        icon={<MagnifyingGlass />}
        title="Không tìm thấy cuộc họp này"
        description="Đường dẫn có thể sai hoặc cuộc họp đã bị xóa."
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
    </Card>
  );
}
