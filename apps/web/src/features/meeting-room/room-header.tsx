"use client";

import { ArrowClockwise, FileText, Record, Stop } from "@phosphor-icons/react";
import Link from "next/link";
import { Button, buttonVariants, FloatCard } from "@recap/admin-ui";
import type { MeetingDto } from "@/lib/api-types";
import { roomActions } from "./session-phase";
import { RoomTopBar, type RecState } from "./room-top-bar";
import type { ViewMode } from "./segment-row";
import { SourceStrip } from "./source-strip";
import type { useRoomController } from "./use-room-controller";
import type { useRoomSearch } from "./use-room-search";

interface RoomHeaderProps {
  meeting: MeetingDto;
  controller: ReturnType<typeof useRoomController>;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  search: ReturnType<typeof useRoomSearch>;
  onStop: () => void;
}

export function recState(ended: boolean, connection: string): RecState {
  if (ended) return "ended";
  if (connection === "ready") return "recording";
  return connection === "reconnecting" ? "reconnecting" : "idle";
}

/** One floating card: title / status / search / view / primary action, then the source strip. */
export function RoomHeader({
  meeting,
  controller,
  view,
  onViewChange,
  search,
  onStop,
}: RoomHeaderProps) {
  const { socket, capture, recording, ended } = controller;
  return (
    <FloatCard as="header" className="gap-3" padding="md" bodyClassName="flex flex-col gap-3">
      <RoomTopBar
        meetingId={meeting.id}
        title={meeting.title}
        rec={recState(ended, socket.connection)}
        elapsedMs={controller.elapsedMs}
        durationMs={controller.stopped ? controller.elapsedMs : meeting.durationMs}
        view={view}
        onViewChange={onViewChange}
        onSearch={search.open ? search.close : search.openSearch}
        searchOpen={search.open}
        action={
          <RoomAction
            ended={ended}
            meetingId={meeting.id}
            recording={recording}
            requesting={capture.phase === "requesting"}
            onStart={controller.start}
            onStop={onStop}
          />
        }
      />
      <SourceStrip
        active={recording}
        sources={capture.sources}
        levels={capture.levels}
        room={socket.room}
      />
    </FloatCard>
  );
}

interface RoomActionProps {
  ended: boolean;
  meetingId: string;
  recording: boolean;
  requesting: boolean;
  onStart: () => void;
  onStop: () => void;
}

/** Exactly one primary button per state; "Biên bản" (outline) sits to the left of "Ghi tiếp". */
function RoomAction({ ended, meetingId, recording, requesting, onStart, onStop }: RoomActionProps) {
  const actions = roomActions(ended, recording);
  if (actions.minutes) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={`/meetings/${meetingId}/minutes`}
          className={buttonVariants({ variant: "outline", shape: "pill" })}
        >
          <FileText size={16} />
          Biên bản
        </Link>
        <Button
          shape="pill"
          onClick={onStart}
          loading={requesting}
          icon={<ArrowClockwise size={16} />}
        >
          Ghi tiếp
        </Button>
      </div>
    );
  }
  if (actions.stop) {
    return (
      <Button
        variant="danger"
        shape="pill"
        onClick={onStop}
        icon={<Stop size={16} weight="fill" />}
      >
        Dừng ghi
      </Button>
    );
  }
  return (
    <Button shape="pill" onClick={onStart} loading={requesting} icon={<Record size={16} />}>
      Bắt đầu ghi
    </Button>
  );
}
