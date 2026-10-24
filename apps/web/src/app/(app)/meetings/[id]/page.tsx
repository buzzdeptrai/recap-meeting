import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingRoom } from "@/features/meeting-room/meeting-room";
import { getMeetingById, getMeetingDetail } from "@/server/meetings-service";

export const dynamic = "force-dynamic";

interface MeetingRoomPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}

/** `?t=<ms>` from a minutes timestamp chip; anything else is ignored. */
function parseFocusMs(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d{1,12}$/.test(value)) return null;
  return Number(value);
}

export async function generateMetadata({ params }: MeetingRoomPageProps): Promise<Metadata> {
  const { id } = await params;
  const meeting = getMeetingById(id);
  return { title: meeting ? `${meeting.title} — Biên bản` : "Biên bản" };
}

export default async function MeetingRoomPage({ params, searchParams }: MeetingRoomPageProps) {
  const { id } = await params;
  const focusMs = parseFocusMs((await searchParams).t);
  const detail = getMeetingDetail(id, { aroundMs: focusMs });
  if (!detail) notFound();
  const { meeting, marks, markAnchors, stats, page } = detail;
  return (
    <MeetingRoom
      meeting={meeting}
      focusMs={focusMs}
      initial={{ page, marks, markAnchors, stats, startedAt: meeting.startedAt }}
    />
  );
}
