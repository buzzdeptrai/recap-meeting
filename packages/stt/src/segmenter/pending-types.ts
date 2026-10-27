import type { SttResult } from "../types";
import type { TimeRange } from "./timing";

export interface HeldText extends TimeRange {
  text: string;
  lang: string | null;
  holdMs: number;
}

export interface PendingInterim {
  result: SttResult;
  tokens: string[];
}
