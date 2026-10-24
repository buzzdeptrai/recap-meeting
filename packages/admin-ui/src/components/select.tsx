"use client";

import { useState, type ReactNode } from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { cn } from "../lib/cn";
import { defaultLabels } from "../labels";
import { CheckIcon, ChevronDownIcon } from "./icons";

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  options: ReadonlyArray<SelectOption>;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Required: a visible label is usually absent in toolbars. */
  ariaLabel: string;
  placeholder?: string;
  /** Text shown before the selected label, e.g. "Nhóm theo:". */
  prefix?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
}

/** Radix Select styled as the white floating dropdown. */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  ariaLabel,
  placeholder = defaultLabels.select,
  prefix,
  disabled,
  name,
  className,
}: SelectProps) {
  const [inner, setInner] = useState(defaultValue);
  // Radix fills <Value> only after mount; render the label ourselves so SSR / first paint is not blank.
  const current = options.find((o) => o.value === (value ?? inner));
  return (
    <RadixSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => {
        setInner(next);
        onValueChange?.(next);
      }}
      disabled={disabled}
      name={name}
    >
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          "soft-focus inline-flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-xl bg-soft-tonal-bg py-2.5 pr-3 pl-4 text-[13px] font-semibold text-soft-tonal-ink hover:bg-soft-tonal-hover disabled:opacity-60 data-[placeholder]:text-soft-muted",
          className,
        )}
      >
        {prefix ? <span className="opacity-80">{prefix}</span> : null}
        <span className="min-w-0 flex-1 truncate text-left">
          <RadixSelect.Value placeholder={placeholder}>{current?.label}</RadixSelect.Value>
        </span>
        <RadixSelect.Icon>
          <ChevronDownIcon />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-(--radix-select-trigger-width) overflow-hidden rounded-xl bg-soft-surface p-1 text-soft-ink shadow-soft-pop"
        >
          <RadixSelect.Viewport>
            {options.map((o) => (
              <RadixSelect.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex cursor-pointer items-center rounded-lg py-2 pr-8 pl-3 text-[13px] font-semibold outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-soft-tonal-bg data-[highlighted]:text-soft-tonal-ink data-[state=checked]:text-soft-brand"
              >
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-3">
                  <CheckIcon />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
