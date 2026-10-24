"use client";

import { Trash } from "@phosphor-icons/react";
import { Button } from "@recap/admin-ui";
import { TRASH_NAME } from "./trash-logic";

/** Entry to the "Đã xóa gần đây" view, quiet and below the list. */
export function TrashLink({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="mt-6 flex justify-center">
      <Button variant="ghost" size="sm" shape="pill" icon={<Trash size={16} />} onClick={onOpen}>
        {TRASH_NAME}
      </Button>
    </div>
  );
}
