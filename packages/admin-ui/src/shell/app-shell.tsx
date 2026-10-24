"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn";
import { defaultLabels, type Labels } from "../labels";
import { MenuIcon } from "../components/icons";
import { ShellContext, DefaultLink } from "./context";
import { PageHeader, type PageHeaderProps } from "./page-header";
import { BrandMark, Sidebar } from "./sidebar";
import type { BrandConfig, NavGroup, ShellLinkComponent } from "./types";

export interface AppShellProps {
  brand: BrandConfig;
  nav: ReadonlyArray<NavGroup>;
  /** Current pathname (e.g. `usePathname()`); drives the active nav item. */
  currentPath?: string;
  /** Link component for nav/brand, e.g. `next/link`. Defaults to `<a>`. */
  linkComponent?: ShellLinkComponent;
  /** Sidebar footer slot (help card). */
  sidebarFooter?: ReactNode;
  /** Sidebar bottom slot (user menu trigger). */
  userMenu?: ReactNode;
  /** Mobile topbar: extra element left of the menu button (e.g. avatar). */
  topbarActions?: ReactNode;
  /** Optional page header rendered above `children`. Pages may instead render `<PageHeader>` themselves. */
  header?: Pick<PageHeaderProps, "breadcrumb" | "title" | "actions">;
  /** Desktop collapse to an icon rail. */
  collapsible?: boolean;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Start with the mobile drawer open (previews / tests). */
  defaultDrawerOpen?: boolean;
  labels?: Partial<Labels>;
  children: ReactNode;
}

const MOBILE_QUERY = "(max-width: 860px)";

function subscribeMobile(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True below the drawer breakpoint (false during SSR; the CSS handles the first paint). */
function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

function useDrawer(initial: boolean) {
  const [open, setOpen] = useState(initial);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const sidebar = document.getElementById(sidebarId);
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    if (mobile) sidebar?.querySelector<HTMLElement>("a[href],button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      if (sidebar?.contains(document.activeElement)) toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    if (mobile) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, sidebarId]);

  // Leaving the mobile breakpoint with the drawer open: reset it.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => {
      if (!mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return { open, setOpen, close, toggleRef, sidebarId };
}

/**
 * Page frame: floating sidebar + content column. Below 860px the sidebar becomes a drawer opened from
 * a sticky topbar (Escape / scrim / link click closes it; focus returns to the menu button).
 */
export function AppShell({
  brand,
  nav,
  currentPath,
  linkComponent = DefaultLink,
  sidebarFooter,
  userMenu,
  topbarActions,
  header,
  collapsible = true,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  defaultDrawerOpen = false,
  labels: labelOverrides,
  children,
}: AppShellProps) {
  const labels = useMemo<Labels>(() => ({ ...defaultLabels, ...labelOverrides }), [labelOverrides]);
  const drawer = useDrawer(defaultDrawerOpen);
  const [innerCollapsed, setInnerCollapsed] = useState(defaultCollapsed);
  const isMobile = useIsMobile();
  // The drawer always shows full labels, whatever the desktop rail state is.
  const collapsed = collapsible && !isMobile && (collapsedProp ?? innerCollapsed);

  const toggleCollapsed = () => {
    const next = !(collapsedProp ?? innerCollapsed);
    if (collapsedProp === undefined) setInnerCollapsed(next);
    onCollapsedChange?.(next);
  };

  const ctx = useMemo(
    () => ({ Link: linkComponent, collapsed, closeDrawer: drawer.close, labels }),
    [linkComponent, collapsed, drawer.close, labels],
  );
  const style = {
    "--soft-side-current": collapsed ? "var(--soft-sidebar-w-collapsed)" : "var(--soft-sidebar-w)",
  } as CSSProperties;

  return (
    <ShellContext.Provider value={ctx}>
      <div
        data-soft-root=""
        style={style}
        className="font-soft min-h-screen bg-soft-bg text-sm leading-[1.55] text-soft-ink antialiased"
      >
        <a
          href="#main"
          className="soft-focus fixed top-2 left-[-999px] z-50 rounded-[10px] bg-soft-surface px-4 py-2 shadow-soft-sm focus:left-4"
        >
          {labels.skipToContent}
        </a>
        <div
          aria-hidden="true"
          data-open={drawer.open}
          onClick={drawer.close}
          className="fixed inset-0 z-20 bg-[rgba(20,23,39,0.4)] opacity-0 transition-opacity duration-250 pointer-events-none data-[open=true]:pointer-events-auto data-[open=true]:opacity-100 min-[861px]:hidden"
        />
        <Sidebar
          id={drawer.sidebarId}
          brand={brand}
          groups={nav}
          currentPath={currentPath}
          footer={sidebarFooter}
          userMenu={userMenu}
          open={drawer.open}
          collapsible={collapsible}
          onToggleCollapsed={toggleCollapsed}
        />
        <div
          className={cn(
            "pt-6 pr-8 pb-10 pl-4 transition-[margin] duration-250 ease-out",
            "min-[861px]:ml-[calc(var(--soft-side-current)+32px)]",
            "max-[860px]:p-0 max-[860px]:px-4 max-[860px]:pb-8",
          )}
        >
          <header className="sticky top-0 z-10 flex items-center gap-3 bg-soft-bg py-4 min-[861px]:hidden">
            <BrandMark brand={brand} compact />
            <div className="ml-auto flex items-center gap-3">
              {topbarActions}
              <button
                ref={drawer.toggleRef}
                type="button"
                aria-label={drawer.open ? labels.closeMenu : labels.openMenu}
                aria-expanded={drawer.open}
                aria-controls={drawer.sidebarId}
                onClick={() => drawer.setOpen((v) => !v)}
                className="soft-focus grid size-10 place-items-center rounded-xl bg-soft-surface shadow-soft-sm"
              >
                <MenuIcon width={20} height={20} />
              </button>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="outline-none">
            {header ? <PageHeader {...header} /> : null}
            {children}
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}
