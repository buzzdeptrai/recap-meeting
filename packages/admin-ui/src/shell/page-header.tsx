import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { defaultLabels } from "../labels";
import { ActionGroup } from "../components/action-group";

export interface Crumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  /** Trail above the title; the last item is the current page. Strings or `{label, href}`. */
  breadcrumb?: ReadonlyArray<string | Crumb>;
  /** `<h1>` content. Wrap a highlighted part in `<GradientText>`. */
  title: ReactNode;
  /** Right end of the title row: pickers, then at most ONE primary button, last. */
  actions?: ReactNode;
  breadcrumbLabel?: string;
  className?: string;
}

/** Gradient-filled inline text (headline accent). */
export function GradientText({ children }: { children: ReactNode }) {
  return <span className="text-soft-gradient">{children}</span>;
}

export function PageHeader({
  breadcrumb,
  title,
  actions,
  breadcrumbLabel = defaultLabels.breadcrumb,
  className,
}: PageHeaderProps) {
  const crumbs = (breadcrumb ?? []).map((c) => (typeof c === "string" ? { label: c } : c));
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {crumbs.length ? (
          <nav aria-label={breadcrumbLabel} className="mb-1 text-xs text-soft-muted">
            <ol className="flex flex-wrap items-center">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <li key={`${c.label}-${i}`} className="flex items-center">
                    {c.href && !last ? (
                      <a href={c.href} className="soft-focus rounded hover:text-soft-ink">
                        {c.label}
                      </a>
                    ) : (
                      <span
                        aria-current={last ? "page" : undefined}
                        className={last ? "font-semibold text-soft-ink" : undefined}
                      >
                        {c.label}
                      </span>
                    )}
                    {last ? null : (
                      <span aria-hidden="true" className="px-1.5">
                        /
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
        <h1 className="text-2xl leading-tight font-bold tracking-[-0.01em] text-soft-ink max-[640px]:text-[22px]">
          {title}
        </h1>
      </div>
      {actions ? <ActionGroup>{actions}</ActionGroup> : null}
    </div>
  );
}
