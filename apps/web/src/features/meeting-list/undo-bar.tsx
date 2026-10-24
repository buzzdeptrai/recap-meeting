"use client";

import { ArrowCounterClockwise, X } from "@phosphor-icons/react";
import { Button, FloatCard, IconButton } from "@recap/admin-ui";
import { useEffect, useRef, useState } from "react";
import { restoreMeetingRest } from "@/lib/api-trash";
import type { MeetingDto } from "@/lib/api-types";

interface UndoBarProps {
  meeting: MeetingDto;
  /** Called after a successful restore so the list refetches. */
  onRestored: () => void;
  onDismiss: () => void;
}

/** "Đã xóa · Hoàn tác" strip under the filters. Focus moves to the undo button (the row is gone). */
export function UndoBar({ meeting, onRestored, onDismiss }: UndoBarProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const undoButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    undoButton.current?.focus();
  }, [meeting.id]);

  const undo = async () => {
    setPending(true);
    setError(null);
    try {
      await restoreMeetingRest(meeting.id);
      onRestored();
      onDismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không hoàn tác được. Hãy thử lại.");
      setPending(false);
    }
  };

  return (
    <FloatCard
      as="div"
      role="status"
      className="mb-4"
      bodyClassName="flex flex-wrap items-center gap-x-3 gap-y-2 !py-3"
    >
      <p className="min-w-0 flex-1 truncate text-[13px] text-soft-ink">
        <strong className="font-bold">Đã xóa</strong> · {meeting.title}
      </p>
      {error ? <p className="text-[13px] text-soft-danger-ink">{error}</p> : null}
      <Button
        ref={undoButton}
        size="sm"
        variant="outline"
        shape="pill"
        loading={pending}
        icon={<ArrowCounterClockwise size={16} />}
        onClick={undo}
      >
        Hoàn tác
      </Button>
      <IconButton
        label="Đóng thông báo"
        icon={<X size={16} />}
        disabled={pending}
        onClick={onDismiss}
      />
    </FloatCard>
  );
}
