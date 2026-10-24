"use client";

import { SegmentedControl } from "@recap/admin-ui";
import { DENSITY_OPTIONS, type Density } from "./density";

interface DensityControlProps {
  density: Density;
  onChange: (density: Density) => void;
}

/** How tightly the transcript is set; remembered per browser (see `useDensity`). */
export function DensityControl({ density, onChange }: DensityControlProps) {
  return (
    <SegmentedControl
      ariaLabel="Mật độ bản ghi"
      options={DENSITY_OPTIONS}
      value={density}
      onValueChange={onChange}
      size="sm"
      variant="soft"
      className="self-start max-[639px]:w-full max-[639px]:[&>*]:flex-1 sm:self-auto"
    />
  );
}
