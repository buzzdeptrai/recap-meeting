import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@recap/admin-ui";
import type { StatusSpec, StatusTone } from "@/lib/status";

const VARIANT: Record<StatusTone, NonNullable<ComponentProps<typeof Badge>["variant"]>> = {
  neutral: "neutral",
  ok: "ok",
  warn: "warn",
  error: "error",
  rec: "rec",
  purple: "purple",
  conclusion: "conclusion",
};

interface StatusBadgeProps extends Omit<ComponentProps<typeof Badge>, "variant" | "dot"> {
  status: StatusSpec;
  /** Defaults to the status label. */
  children?: ReactNode;
  /** Hide the leading dot (e.g. "Ví dụ" tags). */
  plain?: boolean;
}

/** The only way a status is drawn as a badge: tone and label both come from `lib/status.ts`. */
export function StatusBadge({ status, plain = false, children, ...rest }: StatusBadgeProps) {
  return (
    <Badge variant={VARIANT[status.tone]} dot={!plain} {...rest}>
      {children ?? status.label}
    </Badge>
  );
}
