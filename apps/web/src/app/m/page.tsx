import type { Metadata, Viewport } from "next";
import { MobileApp, type MobileLoaded } from "@/features/mobile/mobile-app";
import { requirePageUser } from "@/server/auth-page";
import { getMeetingDetail } from "@/server/meetings-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ghi bằng điện thoại — Biên bản" };

/** Full-bleed on notched phones; the layout pads with env(safe-area-inset-*). */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

interface MobilePageProps {
  searchParams: Promise<{ id?: string | string[] }>;
}

export default async function MobilePage({ searchParams }: MobilePageProps) {
  const raw = (await searchParams).id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const user = await requirePageUser(id ? `/m?id=${encodeURIComponent(id)}` : "/m");
  const detail = id ? getMeetingDetail(id, user) : null;
  const loaded: MobileLoaded | null = detail
    ? {
        meeting: detail.meeting,
        initial: {
          page: detail.page,
          marks: detail.marks,
          markAnchors: detail.markAnchors,
          stats: detail.stats,
          startedAt: detail.meeting.startedAt,
        },
      }
    : null;
  return <MobileApp loaded={loaded} />;
}
