"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@recap/admin-ui";
import { BudgetPanel } from "./budget-panel";
import { GuidePanel } from "./guide-panel";
import type { SettingsModel } from "./settings-model";
import type { SettingsTab } from "./settings-tab";
import { UsersPanel } from "./users-panel";

/** `showUsers` is false for non-admins (the API is admin-only anyway). */
export function SettingsTabs({
  model,
  initialTab,
  showUsers,
}: {
  model: SettingsModel;
  initialTab: SettingsTab;
  showUsers: boolean;
}) {
  return (
    <Tabs defaultValue={initialTab}>
      <TabsList aria-label="Mục cài đặt">
        <TabsTrigger value="guide">Hướng dẫn sử dụng</TabsTrigger>
        <TabsTrigger value="budget">Ngân sách</TabsTrigger>
        {showUsers ? <TabsTrigger value="users">Người dùng</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="guide">
        <GuidePanel />
      </TabsContent>
      <TabsContent value="budget">
        <BudgetPanel budget={model.budget} />
      </TabsContent>
      {showUsers ? (
        <TabsContent value="users">
          <UsersPanel />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
