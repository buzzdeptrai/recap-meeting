import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MinutesView } from "@/features/minutes/minutes-view";
import { getMeetingById } from "@/server/meetings-service";

export const dynamic = "force-dynamic";

interface MinutesPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: MinutesPageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = getMeetingById(id);
  return { title: detail ? `Biên bản — ${detail.title}` : "Biên bản" };
}

export default async function MinutesPage({ params }: MinutesPageProps) {
  const { id } = await params;
  const detail = getMeetingById(id);
  if (!detail) notFound();
  const meeting = detail;
  return (
    <MinutesView
      meeting={{
        id: meeting.id,
        title: meeting.title,
        startedAt: meeting.startedAt ?? meeting.createdAt,
        durationMs: meeting.durationMs,
        ended: meeting.status === "ended",
      }}
    />
  );
}
