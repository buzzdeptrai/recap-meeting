import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { TONE_BG, type Tone } from "./tone";

const tileVariants = cva(
  "grid shrink-0 place-items-center text-white shadow-soft-tile [&_svg]:shrink-0",
  {
    variants: {
      size: {
        sm: "size-8 rounded-[10px] [&_svg]:size-4",
        md: "size-10 rounded-xl [&_svg]:size-5",
        lg: "size-12 rounded-[14px] [&_svg]:size-6",
      },
    },
    defaultVariants: { size: "lg" },
  },
);

export interface IconTileProps extends ComponentProps<"span">, VariantProps<typeof tileVariants> {
  tone?: Tone;
}

/** Rounded gradient tile holding one icon (decorative: it is `aria-hidden`). */
export function IconTile({ tone = "main", size, className, ...rest }: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(tileVariants({ size }), TONE_BG[tone], className)}
      {...rest}
    />
  );
}
