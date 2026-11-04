"use client";

import { ArrowDown } from "@phosphor-icons/react";
import { Button } from "@recap/admin-ui";
import type { Segment } from "@recap/core";
import { formatClock } from "@/lib/format";
import { ConclusionDivider } from "../meeting-room/conclusion-divider";
import { TopicDivider } from "../meeting-room/topic-divider";
import type { RoomState } from "../meeting-room/state";
import { buildTranscriptRows, type TranscriptRow } from "../meeting-room/topics";
import { startsTurn } from "../meeting-room/turns";
import { useFollowScroll } from "../meeting-room/use-follow-scroll";
import { EMPTY_TRANSCRIPT, LISTENING_HINT, MOBILE_SPEAKER_LABEL } from "./mobile-copy";

/** Rows rendered at most; older lines stay in the full transcript (the phone page is not virtualised). */
export const MOBILE_MAX_SEGMENTS = 300;
const DENSITY = "comfortable";

interface MobileTranscriptProps {
  room: RoomState;
  recording: boolean;
}

/** Live transcript with the translation under each line; follows the newest line until you scroll up. */
export function MobileTranscript({ room, recording }: MobileTranscriptProps) {
  const { segments, marks, translations } = room;
  const interim = room.interim[0];
  const visible = segments.slice(-MOBILE_MAX_SEGMENTS);
  const rows = buildTranscriptRows(visible, marks, {
    hasPrev: visible.length < segments.length,
    hasNext: false,
  });
  const version = `${segments.length}|${marks.length}|${interim?.text.length ?? 0}|${
    translations[segments.at(-1)?.id ?? ""]?.text.length ?? 0
  }`;
  const { scroller, following, onScroll, jumpToLatest } = useFollowScroll(version);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto px-3 py-3">
        {rows.length === 0 && !interim && (
          <p className="py-10 text-center text-sm text-soft-muted">{EMPTY_TRANSCRIPT}</p>
        )}
        <TranscriptRows rows={rows} translations={translations} />
        {interim?.text && <p className="mt-2 text-[17px] italic text-soft-muted">{interim.text}</p>}
        {recording && !interim?.text && rows.length > 0 && (
          <p className="mt-2 text-xs text-soft-muted">{LISTENING_HINT}</p>
        )}
      </div>
      {!following && (
        <Button
          size="sm"
          shape="pill"
          className="absolute right-3 bottom-3 shadow-soft-pop"
          icon={<ArrowDown size={14} />}
          onClick={jumpToLatest}
        >
          Mới nhất
        </Button>
      )}
    </div>
  );
}

interface SegmentLineProps {
  segment: Segment;
  header: boolean;
  translation: string | undefined;
}

function SegmentLine({ segment, header, translation }: SegmentLineProps) {
  return (
    <div className="py-1.5">
      {header && (
        <p className="mb-0.5 flex items-center gap-2 text-xs text-soft-muted">
          <span className="font-semibold">{MOBILE_SPEAKER_LABEL}</span>
          <span className="font-soft-mono tabular-nums">{formatClock(segment.startMs)}</span>
        </p>
      )}
      <p className="text-[17px] leading-snug text-soft-ink">{segment.text}</p>
      {translation && (
        <p className="mt-1 border-l-2 border-soft-brand pl-2.5 text-[15px] leading-snug text-soft-muted">
          {translation}
        </p>
      )}
    </div>
  );
}

interface TranscriptRowsProps {
  rows: TranscriptRow[];
  translations: RoomState["translations"];
}

function TranscriptRows({ rows, translations }: TranscriptRowsProps) {
  return (
    <ol className="flex flex-col gap-1">
      {rows.map((row, index) => {
        if (row.type === "divider") {
          return (
            <li key={`t-${row.mark.id}`}>
              <TopicDivider mark={row.mark} name={row.name} density={DENSITY} />
            </li>
          );
        }
        if (row.type === "conclusion") {
          return (
            <li key={`c-${row.mark.id}`}>
              <ConclusionDivider mark={row.mark} density={DENSITY} />
            </li>
          );
        }
        const before = rows[index - 1];
        const previous = before?.type === "segment" ? before.segment : null;
        return (
          <li key={row.segment.id}>
            <SegmentLine
              segment={row.segment}
              header={startsTurn(previous, row.segment)}
              translation={translations[row.segment.id]?.text}
            />
          </li>
        );
      })}
    </ol>
  );
}
