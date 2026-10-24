"use client";

import { cn } from "../lib/cn";
import { useShell } from "./context";
import type { NavItemConfig } from "./types";

export interface NavItemProps {
  item: NavItemConfig;
  active: boolean;
}

const ROW =
  "mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 font-semibold text-soft-muted transition-colors duration-150";

/** One sidebar row: icon tile (gradient when active), label, optional badge. */
export function NavItem({ item, active }: NavItemProps) {
  const { Link, collapsed, closeDrawer } = useShell();
  const tile = (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[10px] bg-soft-surface text-soft-ink shadow-soft-sm [&_svg]:size-4",
        active && "bg-soft-main text-white shadow-[0_4px_7px_rgba(121,40,202,0.35)]",
      )}
    >
      {item.icon}
    </span>
  );
  const label = (
    <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
  );
  const badge =
    item.badge !== undefined && item.badge !== "" && item.badge !== 0 ? (
      <span
        className={cn(
          "soft-tabular rounded-full bg-soft-main px-2 py-px text-[11px] font-bold text-white",
          collapsed && "absolute top-1 right-1 px-1.5",
        )}
      >
        {item.badge}
      </span>
    ) : null;

  if (item.disabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(ROW, "cursor-default opacity-60", collapsed && "justify-center px-0")}
      >
        {tile}
        {label}
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      onClick={closeDrawer}
      className={cn(
        ROW,
        "soft-focus relative hover:bg-soft-bg hover:text-soft-ink",
        active && "bg-soft-surface text-soft-ink shadow-soft hover:bg-soft-surface",
        collapsed && "justify-center px-0",
      )}
    >
      {tile}
      {label}
      {badge}
    </Link>
  );
}
