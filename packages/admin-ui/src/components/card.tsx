import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { ActionGroup } from "./action-group";

const cardVariants = cva("min-w-0 rounded-soft bg-soft-surface text-soft-ink shadow-soft", {
  variants: {
    padding: { none: "", sm: "p-4", md: "p-5 sm:p-6" },
  },
  defaultVariants: { padding: "md" },
});

export interface CardProps
  extends Omit<ComponentProps<"div">, "title">, VariantProps<typeof cardVariants> {
  /** Render as a landmark-ish element; pair `section` with `aria-labelledby`. */
  as?: "div" | "section" | "article" | "aside";
}

/** White rounded surface with the soft shadow. No border by design. */
export function Card({ as: Tag = "div", padding, className, ...rest }: CardProps) {
  return <Tag className={cn(cardVariants({ padding }), className)} {...rest} />;
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned slot: secondary (outline) buttons, a link or a legend. A primary button goes here only when it is the card's one main action. */
  action?: ReactNode;
  /** Put on the title so `<Card aria-labelledby>` can reference it. */
  titleId?: string;
  className?: string;
}

export function CardHeader({ title, description, action, titleId, className }: CardHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 id={titleId} className="text-base font-bold tracking-[-0.01em] text-soft-ink">
          {title}
        </h2>
        {description ? <p className="text-[13px] text-soft-muted">{description}</p> : null}
      </div>
      {action ? <ActionGroup className="shrink-0 justify-end">{action}</ActionGroup> : null}
    </div>
  );
}

/** Small purple text link used in card headers ("Xem tất cả >"). Pass `children` including any icon. */
export function CardLink({ className, ...rest }: ComponentProps<"a">) {
  return (
    <a
      className={cn(
        "soft-focus inline-flex items-center gap-1 rounded-lg text-[13px] font-semibold text-soft-purple hover:underline",
        className,
      )}
      {...rest}
    />
  );
}
