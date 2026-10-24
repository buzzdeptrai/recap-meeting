"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Book,
  CalendarBlank,
  ChartBar,
  FileText,
  Gear,
  House,
  Question,
} from "@phosphor-icons/react";
import { AppShell, HelpCardAction, SidebarHelpCard, type NavGroup } from "@recap/admin-ui";
import { isRoomPath, NAV_SPEC, type NavKey } from "./nav";

const ICONS: Record<NavKey, ReactNode> = {
  overview: <House />,
  meetings: <CalendarBlank />,
  glossary: <Book />,
  usage: <ChartBar />,
  settings: <Gear />,
};

const NAV: NavGroup[] = NAV_SPEC.map((group) => ({
  label: group.label,
  items: group.items.map((item) => ({ label: item.label, href: item.href, icon: ICONS[item.key] })),
}));

/**
 * Shell for every app page, the live room included (it keeps the sidebar; `.room-page` only tints
 * the page background for its floating cards). `userMenu` is built on the server (see `UserSlot`).
 */
export function AppFrame({ userMenu, children }: { userMenu: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={isRoomPath(pathname) ? "room-page" : undefined}>
      <AppShell
        brand={{ name: "Biên bản", subtitle: "Họp song ngữ", icon: <FileText weight="regular" /> }}
        nav={NAV}
        currentPath={pathname}
        linkComponent={Link}
        userMenu={userMenu}
        sidebarFooter={
          <SidebarHelpCard
            icon={<Question weight="bold" />}
            title="Cần trợ giúp?"
            description="Kiểm tra kết nối các nhà cung cấp trong Cài đặt."
            action={<HelpCardAction href="/settings">Mở Cài đặt</HelpCardAction>}
          />
        }
      >
        {children}
      </AppShell>
    </div>
  );
}
