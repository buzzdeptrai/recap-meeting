import { describe, expect, it } from "vitest";
import { sortKeyPointsByTime } from "../src/postprocess";

const p = (text: string, atMs: number | null) => ({ text, atMs });

describe("sortKeyPointsByTime", () => {
  it("orders key points by timestamp", () => {
    const out = sortKeyPointsByTime([
      p("a", 19_000),
      p("b", 76_000),
      p("c", 65_000),
      p("d", 121_000),
    ]);
    expect(out.map((x) => x.text)).toEqual(["a", "c", "b", "d"]);
  });

  it("is stable for equal timestamps", () => {
    const out = sortKeyPointsByTime([p("a", 5), p("b", 5), p("c", 1)]);
    expect(out.map((x) => x.text)).toEqual(["c", "a", "b"]);
  });

  it("keeps points without a timestamp in their slot", () => {
    const out = sortKeyPointsByTime([p("a", 30), p("n", null), p("b", 10)]);
    expect(out.map((x) => x.text)).toEqual(["b", "n", "a"]);
  });

  it("does not mutate the input", () => {
    const input = [p("a", 2), p("b", 1)];
    sortKeyPointsByTime(input);
    expect(input.map((x) => x.text)).toEqual(["a", "b"]);
  });
});
