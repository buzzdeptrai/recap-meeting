import type { Metadata } from "next";
import { Book } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { buttonVariants, Card, EmptyState, PageHeader } from "@recap/admin-ui";

export const metadata: Metadata = { title: "Thuật ngữ — Biên bản" };

export default function GlossaryPage() {
  return (
    <>
      <PageHeader breadcrumb={["Làm việc", "Thuật ngữ"]} title="Thuật ngữ" />
      <Card as="section" aria-label="Thuật ngữ">
        <EmptyState
          icon={<Book />}
          title="Sắp có"
          description="Bảng thuật ngữ riêng giúp chép lời và dịch đúng tên sản phẩm, tên người và từ chuyên ngành. Tính năng này chưa được bật."
          action={
            <Link href="/meetings" className={buttonVariants({ variant: "outline" })}>
              Về danh sách cuộc họp
            </Link>
          }
        />
      </Card>
    </>
  );
}
