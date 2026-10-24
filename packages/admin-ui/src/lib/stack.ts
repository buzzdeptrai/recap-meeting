export interface StackLayer {
  /** Cumulative value below this layer, per index. */
  base: number[];
  /** Cumulative value including this layer, per index. */
  top: number[];
}

/** Cumulative stacking of non-negative series (negative / NaN values count as 0). */
export function stackLayers(
  series: ReadonlyArray<readonly number[]>,
  length: number,
): StackLayer[] {
  let running = new Array<number>(length).fill(0);
  return series.map((values) => {
    const base = running;
    const top = base.map(
      (b, i) => b + Math.max(0, Number.isFinite(values[i]) ? (values[i] as number) : 0),
    );
    running = top;
    return { base, top };
  });
}

/** Per-index totals of several series. */
export function totalsOf(series: ReadonlyArray<readonly number[]>, length: number): number[] {
  const layers = stackLayers(series, length);
  return layers.length ? layers[layers.length - 1]!.top : new Array<number>(length).fill(0);
}
