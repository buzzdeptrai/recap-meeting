export const SETTINGS_TABS = ["guide", "budget", "users"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export function parseTab(raw: string | undefined, showUsers: boolean): SettingsTab {
  const tab = SETTINGS_TABS.find((t) => t === raw) ?? "guide";
  return tab === "users" && !showUsers ? "guide" : tab;
}
