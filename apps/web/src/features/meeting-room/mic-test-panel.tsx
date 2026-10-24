"use client";

import { useSyncExternalStore } from "react";
import { Microphone } from "@phosphor-icons/react";
import { LevelMeter, Select } from "@recap/admin-ui";
import { levelToBars, METER_BARS } from "@/audio/levels";
import { useLevels } from "@/audio/level-store";
import { resolveMicChoice } from "@/audio/mic-devices";
import { loadMicChoice, saveMicChoice, subscribeMicChoice } from "@/audio/mic-storage";
import { useMicDevices } from "./use-mic-devices";
import { useMicTest } from "./use-mic-test";

const SYSTEM_DEFAULT = "__default__";
const QUIET_HINT = "Không có tiếng. Hãy nói thử, hoặc chọn micro khác.";
const UNAVAILABLE_HINT = "Không mở được micro. Cho phép micro trong thanh địa chỉ của trình duyệt.";
const LISTENING_HINT = "Nói thử một câu: thanh bên dưới sẽ nhảy theo giọng bạn.";

/** Remembered choice that still exists (null = system default); server snapshot is null (SSR safe). */
function useMicChoice(devicesReady: boolean, options: Parameters<typeof resolveMicChoice>[1]) {
  const saved = useSyncExternalStore(subscribeMicChoice, loadMicChoice, () => null);
  const choice = devicesReady ? resolveMicChoice(saved, options) : null;
  return { choice, select: saveMicChoice };
}

function hintFor(state: ReturnType<typeof useMicTest>["state"], quiet: boolean): string {
  if (state === "unavailable") return UNAVAILABLE_HINT;
  return quiet ? QUIET_HINT : LISTENING_HINT;
}

/** Pre-record mic picker + live level test. The test stream exists only while `enabled`. */
export function MicTestPanel({ enabled }: { enabled: boolean }) {
  const { options, refresh } = useMicDevices();
  const { choice, select } = useMicChoice(options.length > 0, options);
  const test = useMicTest(choice, enabled, refresh);
  const level = useLevels(test.levels)[0];
  const selectOptions = [
    { value: SYSTEM_DEFAULT, label: "Mặc định của hệ thống" },
    ...options.map((option) => ({ value: option.deviceId, label: option.label })),
  ];
  const warn = test.state === "unavailable" || test.quiet;
  return (
    <section
      aria-label="Kiểm tra micro"
      className="mt-6 flex flex-col gap-3 rounded-soft-inner bg-soft-inset px-4 py-3.5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Microphone size={18} aria-hidden />
        <span className="font-semibold">Micro của bạn</span>
        <Select
          className="min-w-[220px] max-w-full"
          ariaLabel="Chọn micro"
          options={selectOptions}
          value={choice ?? SYSTEM_DEFAULT}
          onValueChange={(value) => select(value === SYSTEM_DEFAULT ? null : value)}
        />
      </div>
      <LevelMeter
        label="Mức tiếng micro"
        value={levelToBars(level)}
        bars={METER_BARS}
        disabled={test.state !== "listening"}
      />
      <p className={warn ? "text-[13px] text-soft-bad" : "text-[13px] text-soft-muted"}>
        {hintFor(test.state, test.quiet)}
      </p>
    </section>
  );
}
