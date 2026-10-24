import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { FloatCard, iconButtonVariants } from "@recap/admin-ui";
import { BeforeYouStart } from "@/features/new-meeting/before-you-start";
import { NewMeetingForm } from "@/features/new-meeting/new-meeting-form";

export const metadata: Metadata = { title: "Cuộc họp mới — Biên bản" };

export default function NewMeetingPage() {
  return (
    <div data-page-tint="" className="flex flex-col gap-4">
      <FloatCard as="header" bodyClassName="flex items-center gap-3">
        <Link
          href="/meetings"
          aria-label="Về danh sách cuộc họp"
          className={iconButtonVariants({ size: "md" }) + " rounded-full"}
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold">Cuộc họp mới</h1>
      </FloatCard>
      <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_360px]">
        <NewMeetingForm />
        <BeforeYouStart />
      </div>
    </div>
  );
}
