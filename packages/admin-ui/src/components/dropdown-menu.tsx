"use client";

import type { ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/cn";

export interface DropdownItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  /** Called on activation. Use `href` for navigation instead. */
  onSelect?: () => void;
  href?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
}

export interface DropdownMenuProps {
  /** The element that opens the menu (rendered via `asChild`, so pass a single focusable element, e.g. a button). */
  trigger: ReactNode;
  /** Optional non-interactive header (name + email). */
  header?: ReactNode;
  items: ReadonlyArray<DropdownItem>;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

const ITEM =
  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-soft-bg";

/** Menu for user / row actions. */
export function DropdownMenu({
  trigger,
  header,
  items,
  align = "end",
  side = "bottom",
  className,
}: DropdownMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align={align}
          side={side}
          sideOffset={8}
          className={cn(
            "z-50 min-w-52 rounded-xl bg-soft-surface p-1 text-soft-ink shadow-soft-pop",
            className,
          )}
        >
          {header ? (
            <div className="border-b border-soft-line px-3 py-2 text-xs text-soft-muted">
              {header}
            </div>
          ) : null}
          {items.map((item) => {
            const cls = cn(ITEM, item.tone === "danger" ? "text-soft-bad" : "text-soft-ink");
            const content = (
              <>
                {item.icon ? (
                  <span className="text-soft-muted [&_svg]:size-4">{item.icon}</span>
                ) : null}
                {item.label}
              </>
            );
            return (
              <Menu.Item
                key={item.id}
                disabled={item.disabled}
                onSelect={item.onSelect}
                asChild={Boolean(item.href)}
                className={cls}
              >
                {item.href ? <a href={item.href}>{content}</a> : content}
              </Menu.Item>
            );
          })}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
