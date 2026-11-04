"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface OptionCardItem<T extends string> {
  value: T;
  title: ReactNode;
  description?: ReactNode;
  /** Leading icon, drawn inside a tonal rounded square (decorative). */
  icon?: ReactNode;
  /** Extra content shown only while this card is selected. */
  children?: ReactNode;
}

export interface OptionCardGroupProps<T extends string> {
  /** Accessible name of the group. */
  ariaLabel: string;
  items: ReadonlyArray<OptionCardItem<T>>;
  value: T;
  onValueChange: (value: T) => void;
  disabled?: boolean;
  /** One column, tighter padding. */
  compact?: boolean;
  className?: string;
}

const GRID = "grid gap-3 sm:grid-cols-2";

const CARD =
  "soft-focus group relative flex min-w-0 cursor-pointer flex-col gap-2 rounded-soft border border-soft-line-strong bg-soft-surface text-left text-soft-ink shadow-soft-sm transition-[transform,box-shadow,border-color,background-color] duration-150 motion-safe:hover:-translate-y-0.5 hover:shadow-soft-float aria-checked:border-soft-brand aria-checked:bg-soft-tonal-bg aria-checked:shadow-[inset_0_0_0_1px_var(--soft-brand)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-soft-sm";

const TILE =
  "grid size-10 shrink-0 place-items-center rounded-xl bg-soft-tonal-bg text-soft-tonal-ink group-aria-checked:bg-soft-brand group-aria-checked:text-white [&_svg]:size-5";

function CheckMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-5 shrink-0 rounded-full bg-soft-brand p-1 text-white"
    >
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Index of the next enabled radio after pressing an arrow key (wraps around). */
export function nextOptionIndex(key: string, index: number, count: number): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/**
 * Radio group drawn as selectable cards: the selected card is outlined in the brand colour,
 * gets a check mark and reveals its `children`. Roving tabindex with arrow-key navigation.
 */
export function OptionCardGroup<T extends string>({
  ariaLabel,
  items,
  value,
  onValueChange,
  disabled = false,
  compact = false,
  className,
}: OptionCardGroupProps<T>) {
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = items.findIndex((item) => item.value === value);
  const tabbable = selectedIndex === -1 ? 0 : selectedIndex;

  function onKeyDown(event: KeyboardEvent, index: number) {
    const target = nextOptionIndex(event.key, index, items.length);
    const next = target === null ? undefined : items[target];
    if (target === null || !next) return;
    event.preventDefault();
    refs.current[target]?.focus();
    onValueChange(next.value);
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(compact ? "grid gap-2" : GRID, className)}
    >
      {items.map((item, index) => {
        const checked = item.value === value;
        return (
          <button
            key={item.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            id={`${baseId}-${item.value}`}
            aria-checked={checked}
            disabled={disabled}
            tabIndex={index === tabbable ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(CARD, compact ? "p-3" : "p-4")}
          >
            <span className="flex items-start gap-3">
              {item.icon ? <span className={TILE}>{item.icon}</span> : null}
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-5 font-bold">{item.title}</span>
                {item.description ? (
                  <span className="mt-0.5 block text-[13px] leading-[18px] text-soft-muted group-aria-checked:text-soft-tonal-ink">
                    {item.description}
                  </span>
                ) : null}
              </span>
              {checked ? <CheckMark /> : null}
            </span>
            {checked && item.children ? (
              <span className="block border-t border-soft-line-strong pt-2 text-[13px]">
                {item.children}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
