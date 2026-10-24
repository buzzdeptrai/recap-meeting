"use client";

import clsx from "clsx";
import type { SttState } from "@recap/core";
import type { RoomState } from "./state";
import type { SourceStatus } from "@/audio/capture";
import { useLevels, type LevelStore } from "@/audio/level-store";
import { LevelMeter } from "@recap/admin-ui";
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

interface MeterCellProps {
  label: string;
  level: number;
  state: string;
  good: boolean;
  available: boolean;
}

function MeterCell({ label, level, state, good, available }: MeterCellProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] font-semibold">{label}</span>
      <LevelMeter
        label={label}
        value={levelToBars(level)}
        bars={METER_BARS}
        disabled={!available}
      />
      <span className={clsx("text-xs", good ? "font-semibold text-[#117a28]" : "text-soft-muted")}>
        {state}
      </span>
    </div>
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
        label="Âm thanh cuộc họp"
        level={tab}
        available={tabOk}
        good={tabOk}
        state={
          !active ? "chưa bật" : { ok: "ổn", missing: "chưa có", ended: "đã dừng" }[sources.tab]
        }
      />
      <MeterCell
        label="Micro của bạn"
        level={mic}
        available={micOk}
        good={micOk}
        state={
          !active ? "chưa bật" : { ok: "ổn", denied: "bị chặn", ended: "đã dừng" }[sources.mic]
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

export function SourceStrip({ active, sources, levels, room }: SourceStripProps) {
  return (
    <div className="flex flex-col gap-2 bg-soft-surface px-4 py-2.5 shadow-[0_1px_0_var(--soft-line)] sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <SourceMeters active={active} sources={sources} levels={levels} />
      <ProviderStatus
        stt={room.stt}
        translateProvider={room.translateProvider}
        translateDegraded={room.translateDegraded}
      />
    </div>
  );
}
