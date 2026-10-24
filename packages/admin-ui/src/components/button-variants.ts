import { cva } from "class-variance-authority";

/** Plain module (no "use client") so server components can call it, e.g. for `<Link>` styling. */
export const buttonVariants = cva(
  "soft-focus inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-bold transition-[box-shadow,background-color,opacity,transform] duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-soft-main text-white shadow-[0_3px_6px_rgba(121,40,202,0.3)] hover:shadow-[0_6px_12px_rgba(121,40,202,0.35)] active:translate-y-px",
        outline: "bg-soft-surface text-soft-ink shadow-soft-sm hover:bg-soft-bg",
        ghost: "text-soft-muted hover:bg-soft-bg hover:text-soft-ink",
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
