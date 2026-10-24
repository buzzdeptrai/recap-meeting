export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  direction: SortDirection;
}

type SortValue = number | string | null | undefined;

function compare(a: SortValue, b: SortValue): number {
  const aMissing = a === null || a === undefined || (typeof a === "number" && Number.isNaN(a));
  const bMissing = b === null || b === undefined || (typeof b === "number" && Number.isNaN(b));
  if (aMissing || bMissing) return Number(aMissing) - Number(bMissing); // missing values sink to the end
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "vi", { numeric: true, sensitivity: "base" });
}

/** Stable sort; `null`/`NaN` always last regardless of direction. Returns a new array. */
export function sortRows<T>(
  rows: readonly T[],
  getValue: (row: T) => SortValue,
  direction: SortDirection,
): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: getValue(row) }))
    .sort((x, y) => {
      const xMissing = x.value === null || x.value === undefined || Number.isNaN(x.value);
      const yMissing = y.value === null || y.value === undefined || Number.isNaN(y.value);
      if (xMissing !== yMissing) return xMissing ? 1 : -1;
      return compare(x.value, y.value) * sign || x.index - y.index;
    })
    .map((x) => x.row);
}

/** Click on a header: new column -> asc, same column asc -> desc, desc -> asc. */
export function nextSort(current: SortState | null, key: string): SortState {
  if (current?.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: "asc" };
}
