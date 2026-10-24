import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface StatTileProps extends Omit<ComponentProps<"div">, "children"> {
  label: ReactNode;
  value: ReactNode;
  /** Small unit after the value ("giây", "ms"). */
  unit?: ReactNode;
}

/** Small inset stat box for 2-up / 4-up grids: muted label, mono number, optional unit. */
export function StatTile({ label, value, unit, className, ...rest }: StatTileProps) {
  return (
    <div
      className={cn("min-w-0 rounded-soft-inner bg-soft-inset px-4 py-3.5", className)}
      {...rest}
    >
      <div className="text-[12.5px] text-soft-muted">{label}</div>
      <div className="soft-tabular mt-0.5 font-soft-mono text-[22px] leading-tight font-semibold text-soft-ink max-[639px]:text-xl">
        {value}
        {unit ? (
          <small className="ml-1 font-soft text-[13px] font-medium text-soft-muted">{unit}</small>
        ) : null}
      </div>
    </div>
  );
}
