import { cva } from "class-variance-authority";

/** Plain module (no "use client") so server components can style `<Link>` as an icon button. */
export const iconButtonVariants = cva(
  "soft-focus inline-flex shrink-0 items-center justify-center text-soft-muted transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      /** `sm` 32px (dense rows, toolbars), `md` 40px. */
      size: { sm: "size-8 rounded-[10px]", md: "size-10 rounded-xl" },
      /** `danger` tints the hover state red (delete). */
      tone: {
        default: "hover:bg-soft-tonal-bg hover:text-soft-tonal-ink",
        danger: "hover:bg-[#fde4e4] hover:text-[#a30606]",
      },
    },
    defaultVariants: { size: "sm", tone: "default" },
  },
);
