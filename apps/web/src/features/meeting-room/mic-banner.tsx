"use client";

import { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Banner, Button } from "@recap/admin-ui";
import type { MicState } from "@/audio/capture-types";
import { MicChooser } from "./mic-chooser";
import { useMicDevices } from "./use-mic-devices";

const MIC_BLOCKED =
  "Không dùng được micro. Cho phép micro trong thanh địa chỉ của trình duyệt để ghi phần của bạn.";
const MIC_SILENT =
  "Mic không có tiếng. Kiểm tra thiết bị đầu vào (Sound > Input), có thể mic iPhone/tai nghe đã ngắt.";
const MIC_LOST = "Mic đã ngắt. Chọn mic khác để tiếp tục:";
const MIC_ENDED = "Mic đã dừng. Chọn mic để tiếp tục:";

interface MicBannerProps {
  mic: Exclude<MicState, "ok">;
  onSwitchMic: (deviceId: string) => Promise<boolean>;
  /** Only passed for the advisory "silent" state; lost/ended/denied stay until fixed. */
  onDismiss?: () => void;
}

/**
 * Mic problem card. Lost/ended list the remaining inputs straight away (one click = switch);
 * silent/denied offer "Chọn lại mic" which opens the same list.
 */
export function MicBanner({ mic, onSwitchMic, onDismiss }: MicBannerProps) {
  const { options, refresh } = useMicDevices();
  const [manualOpen, setManualOpen] = useState(false);
  const autoList = mic === "lost" || mic === "ended";
  const listing = autoList || manualOpen;
  const text = { denied: MIC_BLOCKED, silent: MIC_SILENT, lost: MIC_LOST, ended: MIC_ENDED }[mic];
  const toggle = () => {
    if (!manualOpen) void refresh();
    setManualOpen((open) => !open);
  };
  return (
    <Banner
      tone="warn"
      radius="lg"
      icon={<WarningCircle />}
      onDismiss={onDismiss}
      dismissLabel={onDismiss ? "Đóng" : undefined}
      action={
        autoList ? undefined : (
          <Button size="sm" variant="outline" onClick={toggle}>
            {manualOpen ? "Đóng" : "Chọn lại mic"}
          </Button>
        )
      }
    >
      <span className="flex flex-col gap-2">
        <span>{text}</span>
        {listing && (
          <MicChooser options={options} onPick={onSwitchMic} onDone={() => setManualOpen(false)} />
        )}
      </span>
    </Banner>
  );
}
