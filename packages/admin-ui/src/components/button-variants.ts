import { cva } from "class-variance-authority";

const TONAL = "bg-soft-tonal-bg text-soft-tonal-ink hover:bg-soft-tonal-hover";

/** Plain module (no "use client") so server components can call it, e.g. for `<Link>` styling. */
export const buttonVariants = cva(
  "soft-focus inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-bold transition-[box-shadow,background-color,opacity,transform] duration-150 disabled:pointer-events-none disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-soft-main text-white shadow-[0_3px_6px_rgba(29,78,216,0.3)] hover:shadow-[0_6px_12px_rgba(29,78,216,0.35)] active:translate-y-px",
        /** Secondary action (0.2.2): blue-tinted "tonal" fill, brand ink. `outline` is the legacy name of the same look. */
        tonal: TONAL,
        outline: TONAL,
        /** Neutral white button with a hairline, for places where a tint would compete (e.g. on a tinted surface). */
        plain:
          "bg-soft-surface text-soft-ink shadow-soft-sm ring-1 ring-soft-line-strong ring-inset hover:bg-soft-inset",
        /** Tertiary: no fill, ink text, tint on hover. */
        ghost: "text-soft-ink hover:bg-soft-tonal-bg hover:text-soft-tonal-ink",
        danger:
          "bg-[linear-gradient(310deg,#c60404,#dc1f3a)] text-white shadow-[0_3px_6px_rgba(198,4,4,0.3)] hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-5 text-[13px]",
        lg: "h-12 px-6 text-sm",
        icon: "size-10",
        "icon-sm": "size-8",
      },
      /** `pill` = fully rounded (floating bars, room controls). */
      shape: { default: "", pill: "rounded-full" },
    },
    compoundVariants: [
      { shape: "default", size: ["sm", "icon-sm"], class: "rounded-[10px]" },
      { shape: "default", size: ["md", "lg", "icon"], class: "rounded-xl" },
    ],
    defaultVariants: { variant: "primary", size: "md", shape: "default" },
  },
);
