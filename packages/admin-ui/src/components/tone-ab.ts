/** Two generic neutral row tones (e.g. "self" and "other") plus a plain grey; shared by IconBadge, Bubble, LevelMeter. */
export type RowTone = "tone-a" | "tone-b" | "neutral";

/** Tinted surface (bubble background). */
export const ROW_TONE_SURFACE: Record<RowTone, string> = {
  "tone-a": "bg-soft-tone-a-bg",
  "tone-b": "bg-soft-tone-b-bg",
  neutral: "bg-soft-inset",
};

/** Round icon holder: chip background + ink. */
export const ROW_TONE_CHIP: Record<RowTone, string> = {
  "tone-a": "bg-soft-tone-a-chip text-soft-tone-a-ink",
  "tone-b": "bg-soft-tone-b-chip text-soft-tone-b-ink",
  neutral: "bg-soft-inset-2 text-soft-muted",
};

/** Label ink. */
export const ROW_TONE_INK: Record<RowTone, string> = {
  "tone-a": "text-soft-tone-a-ink",
  "tone-b": "text-soft-tone-b-ink",
  neutral: "text-soft-muted",
};

/** Meter / bar fill. */
export const ROW_TONE_BAR: Record<RowTone, string> = {
  "tone-a": "bg-soft-tone-a-bar",
  "tone-b": "bg-soft-tone-b-bar",
  neutral: "bg-soft-faint",
};
