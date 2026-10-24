"use client";

import type { ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { defaultLabels } from "../labels";
import { ActionGroup } from "./action-group";
import { CloseIcon } from "./icons";

const contentVariants = cva(
  "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-soft bg-soft-surface p-6 text-soft-ink shadow-soft-pop",
  {
    variants: { size: { sm: "max-w-sm", md: "max-w-md", lg: "max-w-xl" } },
    defaultVariants: { size: "md" },
  },
);

export interface DialogProps extends VariantProps<typeof contentVariants> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional element that opens the dialog (uncontrolled use). */
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons row: cancel (ghost) first, primary or danger last. */
  footer?: ReactNode;
  /** Message shown above the footer (`role="alert"`), e.g. a failed request. */
  error?: ReactNode;
  /** An action is running: Escape, scrim click and the close button are disabled. */
  busy?: boolean;
  closeLabel?: string;
  className?: string;
}

/**
 * The one modal pattern. Anatomy: title, optional description, body, error slot, footer.
 * Focus trap, Escape, scrim click and focus return come from Radix.
 */
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  error,
  busy = false,
  size,
  closeLabel = defaultLabels.close,
  className,
}: DialogProps) {
  const block = (event: Event) => {
    if (busy) event.preventDefault();
  };
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[rgba(20,23,39,0.4)]" />
        <RadixDialog.Content
          onEscapeKeyDown={block}
          onInteractOutside={block}
          aria-busy={busy || undefined}
          className={cn(contentVariants({ size }), className)}
        >
          <RadixDialog.Title className="pr-8 text-base font-bold">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-1 text-[13px] text-soft-muted">
              {description}
            </RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          {children ? <div className="mt-4">{children}</div> : null}
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-[#fde4e4] px-4 py-2.5 text-[13px] font-semibold text-[#a30606]"
            >
              {error}
            </p>
          ) : null}
          {footer ? (
            <ActionGroup placement="end" className="mt-6">
              {footer}
            </ActionGroup>
          ) : null}
          <RadixDialog.Close
            aria-label={closeLabel}
            disabled={busy}
            className="soft-focus absolute top-4 right-4 grid size-8 place-items-center rounded-[10px] text-soft-muted hover:bg-soft-tonal-bg hover:text-soft-tonal-ink disabled:opacity-50"
          >
            <CloseIcon />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
