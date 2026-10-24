export type CutReason =
  | "silence"
  | "semantic"
  | "sentence"
  | "hard_cap"
  | "final"
  | "final_split"
  | "buffer_flush"
  | "flush";
