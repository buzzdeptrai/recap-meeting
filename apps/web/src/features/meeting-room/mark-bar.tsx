"use client";

import { BookmarkSimple, Flag } from "@phosphor-icons/react";
import { Button, FloatingActionBar, Kbd } from "@recap/admin-ui";

export const MARK_HINT_ID = "mark-disabled-hint";
export const MARK_DISABLED_TEXT =
  "Chỉ đánh dấu được khi đang ghi. Bấm Bắt đầu ghi hoặc Ghi tiếp trước.";

interface MarkBarProps {
  canMark: boolean;
  onMark: () => void;
  onAddTopic: () => void;
  markError: string | null;
}

/** Hint under the bar: the last marking error, and why the buttons are off. */
function barHint(canMark: boolean, markError: string | null) {
  if (canMark && !markError) return null;
  return (
    <>
      {markError && (
        <span role="alert" className="block text-soft-danger-ink">
          {markError}
        </span>
      )}
      {!canMark && <span id={MARK_HINT_ID}>{MARK_DISABLED_TEXT}</span>}
    </>
  );
}

/** T / K marking buttons, pinned at the bottom centre of the transcript card. */
export function MarkBar({ canMark, onMark, onAddTopic, markError }: MarkBarProps) {
  const describedBy = canMark ? undefined : MARK_HINT_ID;
  return (
    <FloatingActionBar ariaLabel="Đánh dấu trong lúc họp" hint={barHint(canMark, markError)}>
      <Button
        variant="outline"
        shape="pill"
        onClick={onAddTopic}
        disabled={!canMark}
        aria-describedby={describedBy}
      >
        <Flag size={16} className="text-accent" />
        Chủ đề mới
        <Kbd>T</Kbd>
      </Button>
      <Button
        variant="outline"
        shape="pill"
        onClick={onMark}
        disabled={!canMark}
        aria-describedby={describedBy}
      >
        <BookmarkSimple size={16} className="text-decision" />
        Đánh dấu kết luận
        <Kbd>K</Kbd>
      </Button>
    </FloatingActionBar>
  );
}
