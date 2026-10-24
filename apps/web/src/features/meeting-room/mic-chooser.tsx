"use client";

import { useState } from "react";
import { Button } from "@recap/admin-ui";
import type { MicOption } from "@/audio/mic-devices";

const SWITCH_FAILED = "Không mở được micro này. Thử micro khác.";

interface MicChooserProps {
  options: ReadonlyArray<MicOption>;
  onPick: (deviceId: string) => Promise<boolean>;
  /** Called after a successful switch (lets the banner collapse the list). */
  onDone?: () => void;
}

/** One button per input device: one click = hot-swap the mic of the running session. */
export function MicChooser({ options, onPick, onDone }: MicChooserProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const pick = async (deviceId: string) => {
    setBusyId(deviceId);
    setFailed(false);
    const switched = await onPick(deviceId);
    setBusyId(null);
    if (switched) return onDone?.();
    setFailed(true);
  };

  if (options.length === 0) {
    return (
      <p className="text-[13px]">Không thấy micro nào. Cắm hoặc bật thiết bị rồi chờ giây lát.</p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((option) => (
        <Button
          key={option.deviceId}
          size="sm"
          variant="tonal"
          loading={busyId === option.deviceId}
          disabled={busyId !== null}
          onClick={() => void pick(option.deviceId)}
        >
          {option.label}
        </Button>
      ))}
      {failed && <span className="text-[13px] text-soft-bad">{SWITCH_FAILED}</span>}
    </div>
  );
}
