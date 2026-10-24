import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants, PageHeader } from "@recap/admin-ui";
import { MeetingBrowser } from "@/features/meeting-list/meeting-browser";
import { PAGE_SIZE, parseListState } from "@/lib/list-query";
import { listMeetings, serverNow } from "@/server/meetings-service";

export const metadata: Metadata = { title: "Cuộc họp — Biên bản" };

export const dynamic = "force-dynamic";

export default async function MeetingListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseListState(await searchParams);
  const now = serverNow();
  const initial = listMeetings({
    q: state.q,
    status: state.status === "all" ? undefined : state.status,
    minutes: state.minutes === "all" ? undefined : state.minutes,
    lang: state.lang === "all" ? undefined : state.lang,
    range: state.range === "all" ? undefined : state.range,
    from: state.from || undefined,
    to: state.to || undefined,
    sort: state.sort === "auto" ? undefined : state.sort,
    limit: PAGE_SIZE,
    now,
  });
  return (
    <>
      <PageHeader
        breadcrumb={["Làm việc", "Cuộc họp"]}
        title="Cuộc họp"
        actions={
          <Link href="/meetings/new" className={buttonVariants({ variant: "primary", size: "md" })}>
            <Plus size={16} weight="bold" />
            Cuộc họp mới
          </Link>
        }
      />
      <MeetingBrowser initial={initial} initialState={state} now={now} />
    </>
  );
}
