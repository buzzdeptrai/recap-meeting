import { formatChip, transcriptHref } from "./format";

const CHIP =
  "inline-flex h-5 min-w-[46px] items-center justify-center rounded-[4px] border border-line px-1.5 font-mono text-label tabular-nums";

interface TimestampChipProps {
  meetingId: string;
  atMs: number | null;
}

/** mm:ss link back to that moment in the transcript; an empty slot keeps rows aligned. */
export function TimestampChip({ meetingId, atMs }: TimestampChipProps) {
  if (atMs === null) return <span aria-hidden className="w-[46px]" />;
  return (
    <a
      href={transcriptHref(meetingId, atMs)}
      title="Mở đoạn này trong bản ghi"
      aria-label={`Mở bản ghi tại ${formatChip(atMs)}`}
      className={`${CHIP} text-fg-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-accent`}
    >
      {formatChip(atMs)}
    </a>
  );
}
