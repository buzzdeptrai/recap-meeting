import type { CaptureLine } from "../src/capture";
import { turnLines, type TurnSpec } from "./builders";

const w = (text: string) => text.split(" ");

/** Revised hypothesis: the interim says "three", the formatted final says "3". */
export const revisedTurn: TurnSpec = {
  startMs: 0,
  words: w("the team will ship three features next week"),
  interims: [
    w("the"),
    w("the team"),
    w("the team will"),
    w("the team will ship"),
    w("the team will ship three"),
    w("the team will ship three features"),
    w("the team will ship three features next"),
    w("the team will ship three features next week"),
  ],
  finalText: "the team will ship 3 features next week",
};

/** A speaker who really says "no" three times: they are in the final text, so not dups. */
export const genuineRepeatTurn: TurnSpec = {
  startMs: 12_000,
  words: w("no no no we cannot do that this quarter"),
};

/** Vendor repeats the tail of the previous turn at the start of the next one. */
export const overlapTurns: TurnSpec[] = [
  { startMs: 24_000, words: w("let us review the budget numbers for today") },
  {
    startMs: 25_200,
    arrivalShiftMs: 3_000,
    words: w("budget numbers for today and then move on to hiring plans"),
  },
];

export function fixtureLines(): CaptureLine[] {
  const specs = [revisedTurn, genuineRepeatTurn, ...overlapTurns];
  return specs.flatMap((spec) => turnLines(spec)).sort((a, b) => a.tMs - b.tMs);
}
