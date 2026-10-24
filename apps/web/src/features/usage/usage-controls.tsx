"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ActionGroup, SegmentedControl, Select } from "@recap/admin-ui";
import {
  GROUPS,
  GROUP_LABELS,
  RANGES,
  RANGE_LABELS,
  usageHref,
  type GroupKey,
  type RangeKey,
  type UsageViewState,
} from "./usage-url";

/** Range picker + group-by select. Every change is a navigation, so the view stays linkable. */
export function UsageControls({ state }: { state: UsageViewState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (next: Partial<UsageViewState>) =>
    startTransition(() => router.push(usageHref({ ...state, ...next })));
  return (
    <ActionGroup aria-busy={pending}>
      <SegmentedControl
        ariaLabel="Khoảng thời gian"
        value={state.range}
        onValueChange={(range: RangeKey) => go({ range })}
        options={RANGES.map((value) => ({ value, label: RANGE_LABELS[value] }))}
      />
      <Select
        ariaLabel="Nhóm theo"
        prefix="Nhóm theo:"
        value={state.group}
        onValueChange={(group) => go({ group: group as GroupKey })}
        options={GROUPS.map((value) => ({ value, label: GROUP_LABELS[value] }))}
      />
    </ActionGroup>
  );
}
