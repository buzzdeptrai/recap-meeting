"use client";

import { useCallback, useEffect, useState } from "react";
import { listMicInputs, type MicOption } from "@/audio/mic-devices";

/** Available microphones, refreshed on every `devicechange` (plug/unplug, Continuity on/off). */
export function useMicDevices(): { options: MicOption[]; refresh: () => Promise<void> } {
  const [options, setOptions] = useState<MicOption[]>([]);

  const refresh = useCallback(async () => {
    setOptions(await listMicInputs());
  }, []);

  useEffect(() => {
    const devices = navigator.mediaDevices as MediaDevices | undefined;
    if (!devices) return;
    let cancelled = false;
    const load = async () => {
      const next = await listMicInputs();
      if (!cancelled) setOptions(next);
    };
    void load();
    devices.addEventListener("devicechange", load);
    return () => {
      cancelled = true;
      devices.removeEventListener("devicechange", load);
    };
  }, []);

  return { options, refresh };
}
