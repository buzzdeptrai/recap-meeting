"use client";

import { ConfirmDialog } from "@recap/admin-ui";
import type { TrashController } from "./use-trash";
import { DELETE_TITLE, deleteDescription } from "./trash-logic";

/** Confirmation for the soft delete. Escape, scrim and "Hủy" cancel; errors show inside the dialog. */
export function DeleteMeetingDialog({ trash }: { trash: TrashController }) {
  const { target } = trash;
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) trash.cancel();
      }}
      title={DELETE_TITLE}
      description={target ? deleteDescription(target.title) : undefined}
      confirmLabel="Xóa cuộc họp"
      destructive
      onConfirm={trash.confirmDelete}
    />
  );
}
