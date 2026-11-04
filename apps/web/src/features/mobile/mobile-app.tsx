"use client";

import { useState } from "react";
import type { MeetingDto } from "@/lib/api-types";
import type { InitialRoomData } from "../meeting-room/use-meeting-socket";
import { emptyRoomData } from "./mobile-logic";
import { MobileRoom } from "./mobile-room";
import { MobileSetup } from "./mobile-setup";

export interface MobileLoaded {
  meeting: MeetingDto;
  initial: InitialRoomData;
}

interface MobileAppProps {
  /** A meeting opened with `/m?id=` (reload, or coming back after stopping); null = new meeting. */
  loaded: MobileLoaded | null;
}

/** Setup screen until a meeting exists, then the recording room. The URL gains `?id=` so a reload keeps it. */
export function MobileApp({ loaded }: MobileAppProps) {
  const [created, setCreated] = useState<MeetingDto | null>(null);
  if (loaded)
    return <MobileRoom meeting={loaded.meeting} initial={loaded.initial} autoStart={false} />;
  if (!created) {
    return (
      <MobileSetup
        onCreated={(meeting) => {
          window.history.replaceState(null, "", `/m?id=${encodeURIComponent(meeting.id)}`);
          setCreated(meeting);
        }}
      />
    );
  }
  return <MobileRoom meeting={created} initial={emptyRoomData()} autoStart />;
}
