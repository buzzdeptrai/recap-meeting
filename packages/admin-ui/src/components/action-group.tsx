import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * One place for button-row spacing, order and mobile behaviour (8px gap, equal heights).
 * - `toolbar`: page / card headers. Wraps, no reordering.
 * - `end`: dialog footers. DOM order is [cancel, confirm]; right-aligned; on phones stacked full width, confirm last.
 * - `start`: form footers in cards. DOM order is [primary, cancel]; left-aligned; on phones stacked full width, primary last.
 * - `center`: empty / error states.
 */
export const actionGroupVariants = cva("flex items-center gap-2", {
  variants: {
    placement: {
      toolbar: "flex-wrap",
      end: "flex-wrap justify-end max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:[&>*]:w-full",
      start:
        "flex-wrap max-[640px]:flex-col-reverse max-[640px]:items-stretch max-[640px]:[&>*]:w-full",
      center: "flex-wrap justify-center",
    },
  },
  defaultVariants: { placement: "toolbar" },
});

export type ActionPlacement = NonNullable<VariantProps<typeof actionGroupVariants>["placement"]>;

export interface ActionGroupProps
  extends ComponentProps<"div">, VariantProps<typeof actionGroupVariants> {}

/** Row of buttons. Children must share one size (all `sm` or all `md`). */
export function ActionGroup({ placement, className, ...rest }: ActionGroupProps) {
  return <div className={cn(actionGroupVariants({ placement }), className)} {...rest} />;
}
