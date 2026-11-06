import type { Metadata } from "next";
import { nowMs } from "@/features/usage/usage-data";
import { loadDashboard } from "@/features/dashboard/dashboard-data";
import { buildDashboardModel } from "@/features/dashboard/dashboard-model";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { requirePageUser } from "@/server/auth-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tổng quan — Biên bản" };

export default async function OverviewPage() {
  const user = await requirePageUser("/");
  return <DashboardView model={buildDashboardModel(loadDashboard(nowMs(), user))} />;
}
