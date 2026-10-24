import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";

export interface NavItemConfig {
  /** Stable id (defaults to href). */
  id?: string;
  label: string;
  href: string;
  /** Any icon node, 16px inside the tile (e.g. a Phosphor icon). */
  icon: ReactNode;
  /** Count or short text on the right ("3", "Mới"). */
  badge?: number | string;
  /** Force the active state; otherwise derived from `AppShell.currentPath`. */
  active?: boolean;
  /** Render as non-link, dimmed (feature not available yet). */
  disabled?: boolean;
  /** Match only when the path equals href (default: prefix match, `/` is always exact). */
  exact?: boolean;
}

export interface NavGroup {
  /** Small uppercase heading; omit for the top, unlabelled group. */
  label?: string;
  items: ReadonlyArray<NavItemConfig>;
}

export interface BrandConfig {
  name: string;
  /** Second line under the name ("Quản trị"). */
  subtitle?: string;
  /** Icon inside the gradient tile. */
  icon?: ReactNode;
  /** Replaces the tile entirely (your own logo). */
  logo?: ReactNode;
  href?: string;
}

/** Anchor-compatible component, e.g. `next/link`. */
export type ShellLinkComponent = ComponentType<
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>;
