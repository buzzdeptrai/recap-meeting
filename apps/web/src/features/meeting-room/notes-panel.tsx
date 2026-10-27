"use client";

import { NotePencil, Trash } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { NOTE_CONTENT_MAX } from "@recap/core";
import { IconButton, Input } from "@recap/admin-ui";
import { formatClock } from "@/lib/format";
import { SAVE_LABEL, type NoteItem, type SaveState } from "./notes-state";
import type { MeetingNotesApi } from "./use-meeting-notes";

const LIVE_HINT = "Mỗi ghi chú được gắn mốc thời gian của cuộc họp.";
const ENDED_HINT = "Cuộc họp đã kết thúc: ghi chú mới không gắn mốc thời gian.";
const EDIT_FIELD =
  "h-8 w-full min-w-0 rounded-control border border-accent bg-surface px-2 text-small text-fg outline-none placeholder:text-fg-muted";

interface NotesPanelProps {
  notes: MeetingNotesApi;
  /** Current meeting offset in ms while recording, otherwise null. */
  getOffset: () => number | null;
  recording: boolean;
  onJumpTime: (atMs: number) => void;
}

/** "Ghi chú" tab: quick-add input, then the notes in meeting order with inline edit / delete. */
export function NotesPanel({ notes, getOffset, recording, onJumpTime }: NotesPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <NotesHeader count={notes.notes.length} save={notes.save} />
      <NoteComposer notes={notes} getOffset={getOffset} />
      <p className="px-1 text-[12.5px] text-soft-muted">{recording ? LIVE_HINT : ENDED_HINT}</p>
      {notes.error && (
        <p role="alert" className="px-1 text-small font-semibold text-soft-bad">
          {notes.error}
        </p>
      )}
      <NoteList notes={notes} onJumpTime={onJumpTime} />
    </div>
  );
}

function NotesHeader({ count, save }: { count: number; save: SaveState }) {
  return (
    <div className="flex items-center justify-between px-1">
      <h3 className="text-[13px] font-semibold text-soft-muted">Ghi chú tay ({count})</h3>
      <span aria-live="polite" className="text-meta text-fg-muted">
        {SAVE_LABEL[save]}
      </span>
    </div>
  );
}

/** Enter adds. The offset is taken when the first character is typed, not when Enter is hit. */
function NoteComposer({ notes, getOffset }: Pick<NotesPanelProps, "notes" | "getOffset">) {
  const [value, setValue] = useState("");
  const startedAt = useRef<number | null>(null);

  const change = (next: string) => {
    if (value === "" && next !== "") startedAt.current = getOffset();
    setValue(next);
  };

  const submit = async () => {
    const content = value.trim();
    if (!content || notes.load !== "ready") return;
    const atMs = startedAt.current ?? getOffset();
    setValue("");
    startedAt.current = null;
    const added = await notes.add(content, atMs);
    if (!added) setValue((current) => current || content);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  };

  return (
    <Input
      value={value}
      maxLength={NOTE_CONTENT_MAX}
      disabled={notes.load === "loading"}
      placeholder="Gõ ghi chú, Enter để thêm"
      aria-label="Thêm ghi chú"
      onChange={(event) => change(event.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

function NoteList({ notes, onJumpTime }: Pick<NotesPanelProps, "notes" | "onJumpTime">) {
  if (notes.load === "loading") return <p className="px-1 text-small text-fg-muted">Đang tải...</p>;
  if (notes.notes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-6 text-center text-small text-fg-muted">
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-full bg-soft-inset text-soft-faint"
        >
          <NotePencil size={22} />
        </span>
        <p>Chưa có ghi chú nào. Ghi ý quan trọng, biên bản sẽ giữ lại chúng.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {notes.notes.map((note) => (
        <NoteRow key={note.id} note={note} api={notes} onJumpTime={onJumpTime} />
      ))}
    </ul>
  );
}

interface NoteRowProps {
  note: NoteItem;
  api: MeetingNotesApi;
  onJumpTime: (atMs: number) => void;
}

function NoteRow({ note, api, onJumpTime }: NoteRowProps) {
  const [editing, setEditing] = useState(false);
  const original = useRef(note.content);

  const begin = () => {
    original.current = note.content;
    setEditing(true);
  };
  const finish = (keep: boolean) => {
    setEditing(false);
    if (!keep && note.content !== original.current) api.edit(note.id, original.current);
    else api.flush(note.id);
  };

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-soft-inner bg-soft-inset px-3 py-2.5">
      <NoteTime atMs={note.atMs} onJumpTime={onJumpTime} />
      {editing ? (
        <NoteEditor note={note} api={api} onFinish={finish} />
      ) : (
        <NoteText note={note} onEdit={begin} />
      )}
      <IconButton
        size="sm"
        label="Xóa ghi chú"
        icon={<Trash size={14} />}
        disabled={note.pending}
        onClick={() => void api.remove(note.id)}
      />
    </li>
  );
}

function NoteTime({ atMs, onJumpTime }: { atMs: number | null; onJumpTime: (ms: number) => void }) {
  if (atMs === null) {
    return <span className="pt-0.5 font-soft-mono text-meta text-fg-muted">--:--:--</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onJumpTime(atMs)}
      aria-label={`Nhảy tới ${formatClock(atMs)} trong bản ghi`}
      className="soft-focus rounded-md pt-0.5 font-soft-mono text-meta text-soft-accent-ink hover:underline"
    >
      {formatClock(atMs)}
    </button>
  );
}

function NoteText({ note, onEdit }: { note: NoteItem; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={note.pending}
      aria-label={`Sửa ghi chú: ${note.content}`}
      className="soft-focus min-w-0 whitespace-pre-wrap break-words rounded-md text-left text-small text-soft-ink hover:text-soft-accent-ink"
    >
      {note.content}
    </button>
  );
}

interface NoteEditorProps {
  note: NoteItem;
  api: MeetingNotesApi;
  onFinish: (keep: boolean) => void;
}

/** Inline edit: typing saves after a pause, Enter / blur saves now, Esc restores the old text. */
function NoteEditor({ note, api, onFinish }: NoteEditorProps) {
  const [draft, setDraft] = useState(note.content);
  const done = useRef(false);

  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    onFinish(keep && draft.trim() !== "");
  };

  return (
    <input
      autoFocus
      value={draft}
      maxLength={NOTE_CONTENT_MAX}
      aria-label="Sửa ghi chú"
      className={EDIT_FIELD}
      onChange={(event) => {
        setDraft(event.target.value);
        if (event.target.value.trim()) api.edit(note.id, event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") finish(true);
        if (event.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
    />
  );
}
