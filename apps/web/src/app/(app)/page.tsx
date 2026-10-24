import type { Metadata } from "next";
import { nowMs } from "@/features/usage/usage-data";
import { loadDashboard } from "@/features/dashboard/dashboard-data";
import { buildDashboardModel } from "@/features/dashboard/dashboard-model";
import { DashboardView } from "@/features/dashboard/dashboard-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tổng quan — Biên bản" };

export default function OverviewPage() {
  return <DashboardView model={buildDashboardModel(loadDashboard(nowMs()))} />;
}
