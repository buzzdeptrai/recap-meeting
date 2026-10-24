import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { defaultLabels } from "../labels";

const bannerVariants = cva("flex items-center gap-3 text-[13px] text-soft-ink", {
  variants: {
    tone: {
      info: "bg-[#f3e8fd] [&>[data-icon]]:text-[#6b21a8]",
      success: "bg-[#e6f7ea] [&>[data-icon]]:text-[#117a28]",
      /** Olive-yellow (v2): distinct from the amber conclusion tone. */
      warn: "bg-soft-olive-bg text-soft-olive-ink shadow-[inset_0_0_0_1px_var(--soft-olive-line)] [&>[data-icon]]:text-soft-olive-icon",
      error: "bg-[#fde4e4] [&>[data-icon]]:text-[#a30606]",
    },
    /** `card`: rounded block inside content. `bar`: full-width strip under a top bar. */
    layout: {
      card: "px-4 py-3",
      bar: "px-4 py-2.5",
    },
    /** Corner radius of the `card` layout (`lg` = 18px, floating-card pages). */
    radius: { md: "", lg: "" },
  },
  compoundVariants: [
    { layout: "card", radius: "md", class: "rounded-xl" },
    { layout: "card", radius: "lg", class: "rounded-soft-inner" },
  ],
  defaultVariants: { tone: "info", layout: "card", radius: "md" },
});

export interface BannerProps
  extends Omit<ComponentProps<"div">, "children">, VariantProps<typeof bannerVariants> {
  children: ReactNode;
  /** Leading icon (host-provided, 18px). */
  icon?: ReactNode;
  /** Right-aligned control, e.g. a retry `Button size="sm" variant="outline"`. */
  action?: ReactNode;
  /** When set, a close button appears at the end; the host hides the banner. */
  onDismiss?: () => void;
  /** Accessible name of the close button (default "Đóng"). */
  dismissLabel?: string;
}

/** Inline notice. Errors and warnings are `role="alert"`; info and success are `role="status"`. */
export function Banner({
  tone,
  layout,
  radius,
  icon,
  action,
  onDismiss,
  dismissLabel = defaultLabels.close,
  className,
  children,
  ...rest
}: BannerProps) {
  const urgent = tone === "error" || tone === "warn";
  return (
    <div
      role={urgent ? "alert" : "status"}
      className={cn(bannerVariants({ tone, layout, radius }), className)}
      {...rest}
    >
      {icon ? (
        <span data-icon="" className="shrink-0 [&_svg]:size-[18px]">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 font-semibold">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className="soft-focus -my-1 -mr-1.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-[10px] opacity-70 hover:bg-black/5 hover:opacity-100"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
