"use client";

import { useState, type ReactNode } from "react";
import { defaultLabels } from "../labels";
import { Button } from "./button";
import { Dialog } from "./dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Extra body content between the description and the buttons. */
  children?: ReactNode;
  /** Names the action ("Xóa chủ đề"), never just "OK". */
  confirmLabel: string;
  /** Defaults to "Hủy". Use a contextual label only when "Hủy" would be ambiguous ("Tiếp tục ghi"). */
  cancelLabel?: string;
  /** Destructive or hard-to-undo actions use the danger button. */
  destructive?: boolean;
  /** May be async. Resolve to close; throw (or reject) to keep the dialog open and show the message. */
  onConfirm: () => void | Promise<void>;
}

/** Message to show for a failed confirm action. */
export function confirmErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Không thực hiện được. Hãy thử lại.";
}

/** Every confirmation in the app goes through this: same anatomy, button order and pending/error handling. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = defaultLabels.cancel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = (next: boolean) => {
    if (pending) return;
    if (!next) setError(null);
    onOpenChange(next);
  };

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      setError(confirmErrorMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={change}
      size="sm"
      title={title}
      description={description}
      error={error}
      busy={pending}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={() => change(false)}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} loading={pending} onClick={confirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
