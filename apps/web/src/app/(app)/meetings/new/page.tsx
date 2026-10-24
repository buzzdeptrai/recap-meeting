import type { Metadata } from "next";
import { PageHeader } from "@recap/admin-ui";
import { BeforeYouStart } from "@/features/new-meeting/before-you-start";
import { NewMeetingForm } from "@/features/new-meeting/new-meeting-form";

export const metadata: Metadata = { title: "Cuộc họp mới — Biên bản" };

export default function NewMeetingPage() {
  return (
    <>
      <PageHeader breadcrumb={["Cuộc họp", "Mới"]} title="Cuộc họp mới" />
      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_360px]">
        <NewMeetingForm />
        <BeforeYouStart />
      </div>
    </>
  );
}
