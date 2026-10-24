"use client";

import { ArrowCounterClockwise, ArrowLeft, Trash } from "@phosphor-icons/react";
import { Button, EmptyState, FloatCard, Skeleton } from "@recap/admin-ui";
import { useCallback, useEffect, useState } from "react";
import { fetchDeletedMeetings, restoreMeetingRest } from "@/lib/api-trash";
import type { MeetingDto } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { TRASH_NAME } from "./trash-logic";

interface DeletedViewProps {
  onBack: () => void;
  /** A meeting came back: the main list must refetch when the user returns to it. */
  onRestored: () => void;
}

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : "Không tải được danh sách đã xóa.";

function useDeletedList() {
  const [items, setItems] = useState<MeetingDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    fetchDeletedMeetings(signal)
      .then((result) => {
        setItems(result.meetings);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!signal?.aborted) setError(messageOf(e));
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return {
    items,
    error,
    reload: () => load(),
    remove: (id: string) => setItems((list) => list?.filter((m) => m.id !== id) ?? list),
  };
}

function DeletedRow({ meeting, onRestored }: { meeting: MeetingDto; onRestored: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restore = async () => {
    setPending(true);
    setError(null);
    try {
      await restoreMeetingRest(meeting.id);
      onRestored();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không khôi phục được. Hãy thử lại.");
      setPending(false);
    }
  };
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-soft-ink">{meeting.title}</p>
        <p className="soft-tabular text-xs text-soft-muted">
          Đã xóa {meeting.deletedAt ? formatDateTime(meeting.deletedAt) : ""} · tạo{" "}
          {formatDateTime(meeting.createdAt)}
        </p>
        {error ? <p className="text-xs text-soft-danger-ink">{error}</p> : null}
      </div>
      <Button
        size="sm"
        variant="outline"
        shape="pill"
        loading={pending}
        icon={<ArrowCounterClockwise size={16} />}
        onClick={restore}
      >
        Khôi phục
      </Button>
    </li>
  );
}

/** "Đã xóa gần đây": soft-deleted meetings, newest deletion first, each with "Khôi phục". */
export function DeletedMeetings({ onBack, onRestored }: DeletedViewProps) {
  const { items, error, reload, remove } = useDeletedList();
  return (
    <>
      <FloatCard as="header" className="mb-4" bodyClassName="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-xl font-bold">{TRASH_NAME}</h1>
        <Button variant="outline" shape="pill" icon={<ArrowLeft size={16} />} onClick={onBack}>
          Về danh sách
        </Button>
      </FloatCard>
      <FloatCard as="section" padding="none" bodyClassName="py-2" aria-label={TRASH_NAME}>
        {error ? (
          <EmptyState
            title="Không tải được danh sách"
            description={error}
            action={
              <Button variant="outline" shape="pill" onClick={reload}>
                Thử lại
              </Button>
            }
          />
        ) : null}
        {!error && items === null ? <Skeleton className="m-4 h-12" /> : null}
        {!error && items?.length === 0 ? (
          <EmptyState
            icon={<Trash />}
            title="Không có cuộc họp nào đã xóa"
            description="Cuộc họp bạn xóa sẽ nằm ở đây để khôi phục khi cần."
          />
        ) : null}
        {!error && items && items.length > 0 ? (
          <ul className="divide-y divide-soft-line/70">
            {items.map((meeting) => (
              <DeletedRow
                key={meeting.id}
                meeting={meeting}
                onRestored={() => {
                  remove(meeting.id);
                  onRestored();
                }}
              />
            ))}
          </ul>
        ) : null}
      </FloatCard>
    </>
  );
}
