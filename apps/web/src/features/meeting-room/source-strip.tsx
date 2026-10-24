"use client";

import { Microphone, SpeakerHigh } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { SttState } from "@recap/core";
import type { RoomState } from "./state";
import type { SourceStatus } from "@/audio/capture";
import { useLevels, type LevelStore } from "@/audio/level-store";
import { LevelMeter, type RowTone } from "@recap/admin-ui";
import { levelToBars, METER_BARS } from "@/audio/levels";

interface SourceStripProps {
  active: boolean;
  sources: SourceStatus;
  levels: LevelStore;
  room: Pick<RoomState, "stt" | "translateProvider" | "translateDegraded">;
}

const STT_LABEL: Record<SttState, string> = {
  connecting: "đang kết nối",
  open: "đang mở",
  reconnecting: "đang nối lại",
  closed: "đã đóng",
};

const PROVIDER_NAME: Record<string, string> = { gemini: "Gemini", openai: "OpenAI" };

const MIC_LABEL = "Micro";
const TAB_LABEL = "Âm thanh tab";

interface MeterCellProps {
  label: string;
  icon: ReactNode;
  tone: RowTone;
  level: number;
  state: string;
  available: boolean;
}

function MeterCell({ label, icon, tone, level, state, available }: MeterCellProps) {
  return (
    <LevelMeter
      variant="compact"
      label={label}
      icon={icon}
      tone={tone}
      value={levelToBars(level)}
      bars={METER_BARS}
      disabled={!available}
      statusText={state}
      statusTone={available ? "ok" : "muted"}
    />
  );
}

function SourceMeters({
  active,
  sources,
  levels,
}: Pick<SourceStripProps, "active" | "sources" | "levels">) {
  const [mic, tab] = useLevels(levels);
  const tabOk = active && sources.tab === "ok";
  const micOk = active && sources.mic === "ok";
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
      <MeterCell
        label={MIC_LABEL}
        icon={<Microphone />}
        tone="tone-a"
        level={mic}
        available={micOk}
        state={
          !active ? "chưa bật" : { ok: "ổn", denied: "bị chặn", ended: "đã dừng" }[sources.mic]
        }
      />
      <MeterCell
        label={TAB_LABEL}
        icon={<SpeakerHigh />}
        tone="tone-b"
        level={tab}
        available={tabOk}
        state={
          !active ? "chưa bật" : { ok: "ổn", missing: "chưa có", ended: "đã dừng" }[sources.tab]
        }
      />
    </div>
  );
}

function ProviderStatus({ stt, translateProvider, translateDegraded }: SourceStripProps["room"]) {
  if (!stt && !translateProvider) return null;
  const provider = translateProvider
    ? (PROVIDER_NAME[translateProvider] ?? translateProvider)
    : null;
  return (
    <p className="font-soft-mono text-xs text-soft-muted">
      {stt && <span>STT {STT_LABEL[stt]}</span>}
      {provider && (
        <span>
          {stt && " · "}
          {provider}
          {translateDegraded && " (dự phòng)"}
        </span>
      )}
    </p>
  );
}

/** Second row of the header card: inset strip with the two level meters and the STT status. */
export function SourceStrip({ active, sources, levels, room }: SourceStripProps) {
  return (
    <div className="flex flex-col gap-2 rounded-soft-inner bg-soft-inset px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <SourceMeters active={active} sources={sources} levels={levels} />
      <ProviderStatus
        stt={room.stt}
        translateProvider={room.translateProvider}
        translateDegraded={room.translateDegraded}
      />
    </div>
  );
}
