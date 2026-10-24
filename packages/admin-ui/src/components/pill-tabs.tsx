"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { isTabNavKey, nextTabIndex, resolveSelectedTab } from "../lib/tab-nav";
import { Tooltip } from "./tooltip";

export interface PillTab {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  /** Small count badge after the label. */
  count?: number;
  /** `decision` colours the selected count amber (conclusions only). */
  countTone?: "accent" | "decision";
  disabled?: boolean;
  /** Why the tab is disabled; shown as a tooltip and `title`. */
  disabledReason?: string;
}

export interface PillTabsProps {
  tabs: ReadonlyArray<PillTab>;
  ariaLabel: string;
  /** Controlled selection. */
  value?: string;
  /** Uncontrolled initial selection (default: first enabled tab). */
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Base for DOM ids; panels use `pillTabId` / `pillTabPanelId` with the same base. Default: generated. */
  idBase?: string;
  className?: string;
}

export const pillTabId = (base: string, id: string) => `${base}-tab-${id}`;
export const pillTabPanelId = (base: string, id: string) => `${base}-panel-${id}`;

const COUNT_ON = {
  accent: "bg-soft-accent-soft text-soft-accent-ink",
  decision: "bg-soft-conclusion-bg text-soft-conclusion",
} as const;

/**
 * Pill-shaped tablist (WAI-ARIA tabs, automatic activation). Arrow keys / Home / End move between
 * enabled tabs; disabled tabs stay in the DOM with `aria-disabled` and an explanation.
 * Render panels yourself: `role="tabpanel"`, `id={pillTabPanelId(base, id)}`, `aria-labelledby={pillTabId(base, id)}`.
 */
export function PillTabs({
  tabs,
  ariaLabel,
  value,
  defaultValue,
  onValueChange,
  idBase,
  className,
}: PillTabsProps) {
  const generated = useId();
  const base = idBase ?? generated;
  const [inner, setInner] = useState(defaultValue);
  const selected = resolveSelectedTab(tabs, value ?? inner);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onValueChange?.(id);
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (!isTabNavKey(event.key)) return;
    const target = nextTabIndex(
      tabs.map((t) => Boolean(t.disabled)),
      index,
      event.key,
    );
    if (target < 0) return;
    event.preventDefault();
    refs.current[target]?.focus();
    const next = tabs[target];
    if (next) select(next.id);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={cn(
        "flex gap-0.5 rounded-soft-pill bg-soft-inset p-1 max-[639px]:overflow-x-auto max-[639px]:[scrollbar-width:none]",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const on = tab.id === selected;
        const button = (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={pillTabId(base, tab.id)}
            aria-selected={on}
            aria-controls={pillTabPanelId(base, tab.id)}
            aria-disabled={tab.disabled || undefined}
            title={tab.disabled ? tab.disabledReason : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => {
              if (!tab.disabled) select(tab.id);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "soft-focus inline-flex h-[34px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-soft-pill px-3 text-[13px] font-medium whitespace-nowrap text-soft-muted transition-colors duration-150 hover:text-soft-ink",
              on && "bg-soft-surface font-semibold text-soft-ink shadow-soft-seg",
              tab.disabled && "cursor-not-allowed opacity-50 hover:text-soft-muted",
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count === undefined ? null : (
              <span
                className={cn(
                  "inline-grid h-[18px] min-w-[18px] place-items-center rounded-soft-pill px-[5px] text-[11px] font-semibold",
                  on ? COUNT_ON[tab.countTone ?? "accent"] : "bg-soft-inset-2 text-soft-muted",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
        if (!tab.disabled || !tab.disabledReason) return button;
        return (
          <Tooltip key={tab.id} content={tab.disabledReason} side="bottom">
            {button}
          </Tooltip>
        );
      })}
    </div>
  );
}
