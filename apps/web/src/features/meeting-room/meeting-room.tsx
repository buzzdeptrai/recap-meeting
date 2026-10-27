"use client";

import { Info } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import type { MeetingDto } from "@/lib/api-types";
import { Banner, ConfirmDialog } from "@recap/admin-ui";
import { useLeaveGuard } from "@/features/shell/leave-guard";
import { NO_SUGGESTIONS, type MinutesSuggestions } from "./minutes-suggestions";
import { RESUME_HINT } from "./session-phase";
import { useDensity } from "./use-density";
import { RoomBanners } from "./room-banners";
import { RoomBody } from "./room-body";
import { RoomHeader } from "./room-header";
import type { ViewMode } from "./segment-row";
import type { TranscriptHandle } from "./transcript";
import { useRoomSearch } from "./use-room-search";
import { useRoomController } from "./use-room-controller";
import type { InitialRoomData } from "./use-meeting-socket";

interface MeetingRoomProps {
  meeting: MeetingDto;
  initial: InitialRoomData;
  /** Offset (ms) to scroll to and highlight, from a minutes timestamp link. */
  focusMs?: number | null;
  /** Read-only candidates from the stored minutes (side panel "Gợi ý từ biên bản"). */
  suggestions?: MinutesSuggestions;
}

/** Floating cards on the tinted page: header, banners, transcript + side panel (16px gaps). */
export function MeetingRoom({
  meeting,
  initial,
  focusMs = null,
  suggestions = NO_SUGGESTIONS,
}: MeetingRoomProps) {
  const [view, setView] = useState<ViewMode>("both");
  const [density, setDensity] = useDensity();
  const [stopOpen, setStopOpen] = useState(false);
  const controller = useRoomController(meeting, initial, () => setStopOpen(false));
  const { socket, recording, ended } = controller;
  useLeaveGuard(recording, controller.confirmStop);
  const root = useRef<HTMLDivElement>(null);
  const transcript = useRef<TranscriptHandle>(null);
  const search = useRoomSearch({ meetingId: meeting.id, room: socket.room, root, transcript });

  return (
    <div
      ref={root}
      className="flex min-h-[calc(100dvh-4rem)] flex-col gap-4 min-[1360px]:h-[calc(100dvh-4rem)]"
    >
      <RoomHeader
        meeting={meeting}
        controller={controller}
        view={view}
        onViewChange={setView}
        density={density}
        onDensityChange={setDensity}
        search={search}
        onStop={() => setStopOpen(true)}
      />
      {ended && !recording && <ResumeHint />}
      <ControllerBanners controller={controller} />
      <RoomBody
        controller={controller}
        meetingId={meeting.id}
        view={view}
        density={density}
        targetLang={meeting.targetLang ?? "vi"}
        focusMs={focusMs}
        transcript={transcript}
        search={search}
        suggestions={suggestions}
      />
      <StopDialog open={stopOpen} onOpenChange={setStopOpen} onConfirm={controller.confirmStop} />
    </div>
  );
}

interface StopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function StopDialog({ open, onOpenChange, onConfirm }: StopDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Dừng ghi cuộc họp?"
      description="Phiên ghi sẽ kết thúc. Bản ghi và bản dịch đã có vẫn được giữ lại."
      confirmLabel="Dừng ghi"
      cancelLabel="Tiếp tục ghi"
      destructive
      onConfirm={onConfirm}
    />
  );
}

function ControllerBanners({ controller }: { controller: ReturnType<typeof useRoomController> }) {
  const { socket, capture } = controller;
  return (
    <RoomBanners
      phase={capture.phase}
      sources={capture.sources}
      captureError={capture.error}
      connection={socket.connection}
      room={socket.room}
      onReshare={capture.reshareTab}
      onSwitchMic={capture.switchMic}
      onRetry={socket.retry}
      onRetryStt={socket.retryStt}
      onDismissError={socket.clearError}
    />
  );
}

/** Informational and safe to hide: it is static copy that does not describe a fault. */
function ResumeHint() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <Banner tone="info" radius="lg" icon={<Info />} onDismiss={() => setHidden(true)}>
      {RESUME_HINT}
    </Banner>
  );
}
