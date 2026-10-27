import type { Metadata } from "next";
import { PageHeader } from "@recap/admin-ui";
import { buildSettingsModel } from "@/features/settings/settings-model";
import { parseTab } from "@/features/settings/settings-tab";
import { SettingsTabs } from "@/features/settings/settings-tabs";
import { getCurrentUserForShell } from "@/server/current-user";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cài đặt — Biên bản" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).tab;
  const user = await getCurrentUserForShell();
  // Until sessions exist (user is null) the tab stays visible; members never see it.
  const showUsers = user === null || user.role === "admin";
  const tab = parseTab(Array.isArray(raw) ? raw[0] : raw, showUsers);
  return (
    <>
      <PageHeader breadcrumb={["Quản trị", "Cài đặt"]} title="Cài đặt" />
      <SettingsTabs model={buildSettingsModel()} initialTab={tab} showUsers={showUsers} />
    </>
  );
}
