"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { nextSort, sortRows, type SortState } from "../lib/sort";
import { ArrowDownIcon, ArrowUpIcon } from "./icons";

export interface DataColumn<T> {
  key: string;
  header: ReactNode;
  /** Cell content. Defaults to `String(row[key])`. */
  cell?: (row: T) => ReactNode;
  /** Right-aligned, mono, tabular numbers. */
  numeric?: boolean;
  align?: "left" | "right" | "center";
  /** Click-to-sort header. Uses `sortValue`, else `row[key]`. */
  sortable?: boolean;
  sortValue?: (row: T) => number | string | null | undefined;
  /** Tinted column (the metric currently charted). */
  highlight?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataColumn<T>>;
  rows: ReadonlyArray<T>;
  rowKey: (row: T) => string;
  /** Visually hidden table title for screen readers. */
  caption?: string;
  /** Totals row keyed by column key (rendered in `<tfoot>`, bold). */
  footer?: Readonly<Record<string, ReactNode>>;
  defaultSort?: SortState;
  /** Controlled sort. */
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  /** Shown instead of the body when `rows` is empty. */
  empty?: ReactNode;
  /** Horizontal scroll threshold, px. */
  minWidth?: number;
  className?: string;
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

function alignOf<T>(col: DataColumn<T>) {
  return ALIGN[col.align ?? (col.numeric ? "right" : "left")];
}

function readCell<T>(row: T, col: DataColumn<T>): ReactNode {
  if (col.cell) return col.cell(row);
  const raw = (row as Record<string, unknown>)[col.key];
  return raw === null || raw === undefined ? "" : String(raw);
}

function SortHeader<T>({
  col,
  sort,
  onSort,
}: {
  col: DataColumn<T>;
  sort: SortState | null;
  onSort: (key: string) => void;
}) {
  const active = sort?.key === col.key;
  return (
    <button
      type="button"
      onClick={() => onSort(col.key)}
      className={cn(
        "soft-focus inline-flex cursor-pointer items-center gap-1 rounded-md uppercase hover:text-soft-ink",
        col.align === "right" || col.numeric ? "flex-row-reverse" : "",
      )}
    >
      {col.header}
      <span
        className={cn(
          "inline-grid size-3 place-items-center",
          active ? "text-soft-brand" : "opacity-0",
        )}
        aria-hidden="true"
      >
        {sort?.direction === "desc" && active ? (
          <ArrowDownIcon width={12} height={12} />
        ) : (
          <ArrowUpIcon width={12} height={12} />
        )}
      </span>
    </button>
  );
}

/** Light table: uppercase header, hairline rows, right-aligned tabular numbers, optional sorting and totals. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  footer,
  defaultSort,
  sort: controlled,
  onSortChange,
  empty,
  minWidth = 640,
  className,
}: DataTableProps<T>) {
  const [inner, setInner] = useState<SortState | null>(defaultSort ?? null);
  const sort = controlled === undefined ? inner : controlled;

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!sort || !col) return rows;
    const get =
      col.sortValue ??
      ((row: T) => (row as Record<string, unknown>)[col.key] as number | string | null | undefined);
    return sortRows(rows, get, sort.direction);
  }, [rows, columns, sort]);

  const onSort = (key: string) => {
    const next = nextSort(sort, key);
    if (controlled === undefined) setInner(next);
    onSortChange?.(next);
  };

  return (
    <div className={cn("-mx-2 overflow-x-auto px-2", className)}>
      <table className="w-full border-collapse" style={{ minWidth }}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={col.key}
                scope="col"
                aria-sort={
                  sort?.key === col.key
                    ? sort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
                className={cn(
                  "px-3 pb-3 text-[11px] font-bold tracking-[0.06em] whitespace-nowrap text-soft-muted uppercase",
                  alignOf(col),
                  i === 0 && "pl-0",
                )}
              >
                {col.sortable ? <SortHeader col={col} sort={sort} onSort={onSort} /> : col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={cn(
                      "border-t border-soft-line p-3 align-middle text-[13px]",
                      alignOf(col),
                      col.numeric && "soft-tabular font-soft-mono",
                      col.highlight && "bg-[rgba(29,78,216,0.05)] font-bold text-soft-ink",
                      i === 0 && "pl-0",
                      col.className,
                    )}
                  >
                    {readCell(row, col)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer ? (
          <tfoot>
            <tr>
              {columns.map((col, i) => (
                <td
                  key={col.key}
                  className={cn(
                    "border-t border-soft-line p-3 text-[13px] font-bold text-soft-ink",
                    alignOf(col),
                    col.numeric && "soft-tabular font-soft-mono",
                    i === 0 && "pl-0",
                  )}
                >
                  {footer[col.key] ?? null}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
