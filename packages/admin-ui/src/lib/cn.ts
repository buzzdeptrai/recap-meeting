import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Teach tailwind-merge about the Soft theme names so `text-soft-ink` vs `text-white` resolve. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "bg-image": [
        { bg: ["soft-main", "soft-dark", "soft-blue", "soft-orange", "soft-green", "soft-red"] },
      ],
    },
    theme: {
      color: [
        "soft-bg",
        "soft-surface",
        "soft-ink",
        "soft-muted",
        "soft-line",
        "soft-fill",
        "soft-brand",
        "soft-purple",
        "soft-pink",
        "soft-navy",
        "soft-ok",
        "soft-bad",
        "soft-warn",
        "soft-conclusion",
        "soft-conclusion-bg",
        "soft-conclusion-line",
        "soft-page",
        "soft-inset",
        "soft-inset-2",
        "soft-line-strong",
        "soft-faint",
        "soft-accent",
        "soft-accent-soft",
        "soft-accent-ink",
        "soft-tone-a-bg",
        "soft-tone-a-ink",
        "soft-tone-a-chip",
        "soft-tone-a-bar",
        "soft-tone-b-bg",
        "soft-tone-b-ink",
        "soft-tone-b-chip",
        "soft-tone-b-bar",
        "soft-info-bg",
        "soft-info-ink",
        "soft-info-line",
        "soft-ok-bg",
        "soft-ok-ink",
        "soft-danger-bg",
        "soft-danger-ink",
        "soft-olive-bg",
        "soft-olive-ink",
        "soft-olive-line",
        "soft-olive-icon",
      ],
      shadow: ["soft", "soft-sm", "soft-tile", "soft-pop", "soft-card", "soft-float", "soft-seg"],
      radius: ["soft", "soft-card", "soft-inner", "soft-pill"],
    },
  },
});

/** clsx + tailwind-merge: the shadcn `cn` helper. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
