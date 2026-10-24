"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { ChevronsLeftIcon } from "../components/icons";
import { useShell } from "./context";
import { NavItem } from "./nav-item";
import { resolveActiveItem } from "./active";
import type { BrandConfig, NavGroup } from "./types";

export interface SidebarProps {
  id: string;
  brand: BrandConfig;
  groups: ReadonlyArray<NavGroup>;
  currentPath?: string;
  /** Pinned above the user menu: typically `<SidebarHelpCard />`. Hidden when collapsed. */
  footer?: ReactNode;
  /** Pinned at the very bottom: user avatar + name button / dropdown. */
  userMenu?: ReactNode;
  open: boolean;
  collapsible: boolean;
  onToggleCollapsed: () => void;
}

export function BrandMark({ brand, compact }: { brand: BrandConfig; compact?: boolean }) {
  const { Link, collapsed } = useShell();
  const hideText = compact ? false : collapsed;
  return (
    <Link
      href={brand.href ?? "/"}
      className="soft-focus flex items-center gap-3 rounded-xl text-base font-bold text-soft-ink"
    >
      {brand.logo ?? (
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-soft-main text-white shadow-[0_4px_7px_rgba(29,78,216,0.3)] [&_svg]:size-5"
        >
          {brand.icon}
        </span>
      )}
      <span className={cn("min-w-0 leading-tight", hideText && "sr-only")}>
        {brand.name}
        {brand.subtitle && !compact ? (
          <small className="block text-xs font-normal text-soft-muted">{brand.subtitle}</small>
        ) : null}
      </span>
    </Link>
  );
}

/** The floating white rail. Positioned/animated by `AppShell` through its container classes. */
export function Sidebar({
  id,
  brand,
  groups,
  currentPath,
  footer,
  userMenu,
  open,
  collapsible,
  onToggleCollapsed,
}: SidebarProps) {
  const { collapsed, labels } = useShell();
  const active = resolveActiveItem(groups, currentPath);
  return (
    <aside
      id={id}
      data-open={open}
      aria-label={labels.navigation}
      className={cn(
        "fixed inset-y-4 left-4 z-30 flex w-(--soft-sidebar-w) flex-col overflow-x-hidden overflow-y-auto rounded-soft border border-soft-line-strong bg-soft-surface px-4 pt-6 pb-4 shadow-soft",
        "transition-[transform,visibility,width] duration-250 ease-out",
        collapsed && "w-(--soft-sidebar-w-collapsed) px-3",
        "max-[860px]:inset-y-2 max-[860px]:left-2 max-[860px]:w-[min(300px,calc(100vw-16px))] max-[860px]:invisible max-[860px]:-translate-x-[calc(100%+24px)] max-[860px]:px-4",
        "max-[860px]:data-[open=true]:visible max-[860px]:data-[open=true]:translate-x-0",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-2 pb-6",
          collapsed && "justify-center px-0",
        )}
      >
        <BrandMark brand={brand} />
        {collapsible && !collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={labels.collapseSidebar}
            className="soft-focus grid size-8 shrink-0 place-items-center rounded-[10px] text-soft-muted hover:bg-soft-tonal-bg hover:text-soft-tonal-ink max-[860px]:hidden"
          >
            <ChevronsLeftIcon />
          </button>
        ) : null}
      </div>
      {collapsible && collapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={labels.expandSidebar}
          className="soft-focus mx-auto mb-3 grid size-8 place-items-center rounded-[10px] text-soft-muted hover:bg-soft-tonal-bg hover:text-soft-tonal-ink max-[860px]:hidden"
        >
          <ChevronsLeftIcon className="rotate-180" />
        </button>
      ) : null}
      <div className="mx-2 mb-4 h-px bg-[linear-gradient(90deg,transparent,#d8dce3_40%,#d8dce3_60%,transparent)]" />
      <nav aria-label={labels.pages}>
        {groups.map((group, gi) => (
          <div key={group.label ?? `g${gi}`}>
            {group.label ? (
              <span
                className={cn(
                  "block px-3 pt-4 pb-2 text-[11px] font-bold tracking-[0.08em] text-soft-muted uppercase",
                  collapsed && "sr-only",
                )}
              >
                {group.label}
              </span>
            ) : null}
            {group.items.map((item) => (
              <NavItem key={item.id ?? item.href} item={item} active={item === active} />
            ))}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3 pt-6">
        {footer && !collapsed ? footer : null}
        {userMenu}
      </div>
    </aside>
  );
}

export interface SidebarHelpCardProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Usually a white button/link: `<a className={...}>`. See `HelpCardAction` for the stock look. */
  action?: ReactNode;
}

/** Gradient call-out for the sidebar footer slot. */
export function SidebarHelpCard({ icon, title, description, action }: SidebarHelpCardProps) {
  return (
    <div className="relative overflow-hidden rounded-soft bg-soft-main p-4 text-white">
      <span
        aria-hidden="true"
        className="absolute -top-7 -right-7 size-24 rounded-full bg-white/15"
      />
      {icon ? (
        <span
          aria-hidden="true"
          className="relative mb-3 grid size-8 place-items-center rounded-[10px] bg-white text-[#1d4ed8] [&_svg]:size-4"
        >
          {icon}
        </span>
      ) : null}
      <b className="relative block text-sm">{title}</b>
      {description ? (
        <p className="relative mt-0.5 mb-3 text-xs opacity-95">{description}</p>
      ) : null}
      {action ? <div className="relative">{action}</div> : null}
    </div>
  );
}

/** White "Xem tài liệu" style button for `SidebarHelpCard.action`. */
export function HelpCardAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="soft-focus block rounded-[10px] bg-white px-4 py-2 text-center text-xs font-bold text-[#1e3a8a] shadow-soft-sm"
    >
      {children}
    </a>
  );
}
