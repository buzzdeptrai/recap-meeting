export type Tone = "main" | "blue" | "orange" | "green" | "red" | "dark";

/** Tailwind utility per tone (gradient background). */
export const TONE_BG: Record<Tone, string> = {
  main: "bg-soft-main",
  blue: "bg-soft-blue",
  orange: "bg-soft-orange",
  green: "bg-soft-green",
  red: "bg-soft-red",
  dark: "bg-soft-dark",
};

/** CSS `background` value per tone, for inline styles (progress fills, chart swatches). */
export const TONE_GRADIENT: Record<Tone, string> = {
  main: "var(--soft-g-main)",
  blue: "var(--soft-g-blue)",
  orange: "var(--soft-g-orange)",
  green: "var(--soft-g-green)",
  red: "var(--soft-g-red)",
  dark: "var(--soft-g-dark)",
};

/** Glow under a coloured tile / button. */
export const TONE_GLOW: Record<Tone, string> = {
  main: "shadow-[var(--soft-glow-main)]",
  blue: "shadow-[0_4px_7px_rgba(33,82,255,0.28)]",
  orange: "shadow-[0_4px_7px_rgba(245,57,57,0.25)]",
  green: "shadow-[0_4px_7px_rgba(23,173,55,0.28)]",
  red: "shadow-[0_4px_7px_rgba(234,6,6,0.25)]",
  dark: "shadow-[0_4px_7px_rgba(20,23,39,0.3)]",
};
