import { ArrowDown } from "@phosphor-icons/react";
import { Button } from "@recap/admin-ui";
import type { TargetLang } from "@recap/core";
import type { Density } from "./density";
import { InterimRow, SegmentRow, type ViewMode } from "./segment-row";
import type { RoomState } from "./state";
import { ConclusionDivider } from "./conclusion-divider";
import { TopicDivider } from "./topic-divider";
import type { EdgeState } from "./use-transcript-pager";
import { EDGE_ROW_PX, type VirtualRow } from "./virtual-rows";

export function LatestPill({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      shape="pill"
      icon={<ArrowDown size={16} />}
      onClick={onClick}
      className="animate-fade-in absolute bottom-[116px] left-1/2 -translate-x-1/2 rounded-full shadow-soft-pop"
    >
      {label}
    </Button>
  );
}

interface EdgeRowProps {
  side: "top" | "bottom";
  state: EdgeState;
  onRetry: () => void;
}

/** Placeholder above / below the loaded run while the next page is on its way. */
export function EdgeRow({ side, state, onRetry }: EdgeRowProps) {
  return (
    <div
      style={{ height: EDGE_ROW_PX }}
      className="flex items-center justify-center text-small text-fg-muted"
    >
      {state === "error" ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Không tải được. Thử lại
        </Button>
      ) : (
        <span role="status">{side === "top" ? "Đang tải đoạn trước…" : "Đang tải đoạn tiếp…"}</span>
      )}
    </div>
  );
}

export interface RowViewContext {
  room: RoomState;
  view: ViewMode;
  density: Density;
  /** Language the meeting translates into (rows tag only other languages). */
  targetLang: TargetLang;
  highlightId: string | null;
  terms: readonly string[] | undefined;
  /** First live seq (those fade in) and the newest one whose fade already played. */
  liveFromSeq: number | null;
  settledSeq: number;
  edge: { top: EdgeState; bottom: EdgeState };
  onRetryEdge: (side: "top" | "bottom") => void;
}

export function VirtualRowView({ row, ctx }: { row: VirtualRow; ctx: RowViewContext }) {
  switch (row.type) {
    case "edge":
      return (
        <EdgeRow
          side={row.side}
          state={ctx.edge[row.side]}
          onRetry={() => ctx.onRetryEdge(row.side)}
        />
      );
    case "divider":
      return <TopicDivider mark={row.mark} name={row.name} density={ctx.density} />;
    case "conclusion":
      return <ConclusionDivider mark={row.mark} density={ctx.density} />;
    case "interim":
      return (
        <InterimRow
          channel={row.channel}
          line={row.line}
          density={ctx.density}
          showHeader={row.showHeader}
        />
      );
    case "segment": {
      const { segment } = row;
      return (
        <SegmentRow
          segment={segment}
          translation={ctx.room.translations[segment.id]}
          view={ctx.view}
          density={ctx.density}
          targetLang={ctx.targetLang}
          showHeader={row.showHeader}
          animate={
            ctx.liveFromSeq !== null &&
            segment.seq >= ctx.liveFromSeq &&
            segment.seq > ctx.settledSeq
          }
          highlight={segment.id === ctx.highlightId}
          terms={ctx.terms}
        />
      );
    }
  }
}
