export type AlignOp =
  | { type: "match" | "sub"; a: number; b: number }
  | { type: "ins"; a: number } // token only in `a` (extra emitted word)
  | { type: "del"; b: number }; // token only in `b` (final word that was never emitted)

const BAND = 400;
const INF = 1 << 28;

/**
 * Banded Levenshtein alignment of `a` (emitted words) against `b` (final-turn words).
 * Drift between the two sequences is local, so a diagonal band keeps long meetings cheap.
 */
export function alignTokens(a: readonly string[], b: readonly string[]): AlignOp[] {
  const n = a.length;
  const m = b.length;
  const lo = (i: number) => Math.max(0, i - BAND - Math.max(0, n - m));
  const hi = (i: number) => Math.min(m, i + BAND + Math.max(0, m - n));
  const span = 2 * BAND + Math.abs(n - m) + 1;
  const cost = new Int32Array((n + 1) * span).fill(INF);
  const get = (i: number, j: number): number => {
    if (i < 0 || j < 0 || j < lo(i) || j > hi(i)) return INF;
    return cost[i * span + (j - lo(i))]!;
  };
  for (let i = 0; i <= n; i++) {
    for (let j = lo(i); j <= hi(i); j++) {
      let best = i === 0 && j === 0 ? 0 : INF;
      if (i > 0 && j > 0)
        best = Math.min(best, get(i - 1, j - 1) + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 0) best = Math.min(best, get(i - 1, j) + 1);
      if (j > 0) best = Math.min(best, get(i, j - 1) + 1);
      cost[i * span + (j - lo(i))] = best;
    }
  }
  return backtrace(a, b, get);
}

function backtrace(
  a: readonly string[],
  b: readonly string[],
  get: (i: number, j: number) => number,
): AlignOp[] {
  const ops: AlignOp[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    const here = get(i, j);
    const same = i > 0 && j > 0 && a[i - 1] === b[j - 1];
    if (i > 0 && j > 0 && get(i - 1, j - 1) + (same ? 0 : 1) === here) {
      ops.push({ type: same ? "match" : "sub", a: i - 1, b: j - 1 });
      i--;
      j--;
    } else if (i > 0 && get(i - 1, j) + 1 === here) {
      ops.push({ type: "ins", a: i - 1 });
      i--;
    } else {
      ops.push({ type: "del", b: j - 1 });
      j--;
    }
  }
  return ops.reverse();
}
