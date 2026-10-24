/**
 * Monotone cubic interpolation (Fritsch-Carlson) turned into SVG cubic Bezier segments.
 * Guarantee: between two neighbouring points the curve never leaves [min(y0,y1), max(y0,y1)],
 * so a smooth line can never dip below zero or poke above a peak the data does not have.
 */

export type Point = readonly [number, number];

export interface BezierSegment {
  c1: Point;
  c2: Point;
  to: Point;
}

/** Tangent slopes per point: zero at local extrema, capped so alpha^2 + beta^2 <= 9. */
function tangents(points: readonly Point[]): number[] {
  const n = points.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    dx.push(b[0] - a[0]);
    m.push(dx[i] === 0 ? 0 : (b[1] - a[1]) / dx[i]!);
  }
  const t: number[] = new Array<number>(n).fill(0);
  t[0] = m[0]!;
  t[n - 1] = m[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    const prev = m[i - 1]!;
    const next = m[i]!;
    t[i] = prev * next <= 0 ? 0 : (prev + next) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    const slope = m[i]!;
    if (slope === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const alpha = t[i]! / slope;
    const beta = t[i + 1]! / slope;
    const h = alpha * alpha + beta * beta;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * alpha * slope;
      t[i + 1] = k * beta * slope;
    }
  }
  return t;
}

const clamp = (v: number, a: number, b: number) =>
  Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));

/** Bezier segments joining consecutive points (empty for < 2 points). X must be non-decreasing. */
export function monotoneSegments(points: readonly Point[]): BezierSegment[] {
  if (points.length < 2) return [];
  const t = tangents(points);
  const out: BezierSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b[0] - a[0];
    out.push({
      c1: [a[0] + dx / 3, clamp(a[1] + (t[i]! * dx) / 3, a[1], b[1])],
      c2: [b[0] - dx / 3, clamp(b[1] - (t[i + 1]! * dx) / 3, a[1], b[1])],
      to: b,
    });
  }
  return out;
}

const f = (n: number) => Number(n.toFixed(2));
const seg = (s: BezierSegment) =>
  `C${f(s.c1[0])} ${f(s.c1[1])} ${f(s.c2[0])} ${f(s.c2[1])} ${f(s.to[0])} ${f(s.to[1])}`;

/** SVG path `d` for a smooth line through the points. */
export function smoothLinePath(points: readonly Point[]): string {
  const first = points[0];
  if (!first) return "";
  const head = `M${f(first[0])} ${f(first[1])}`;
  return head + monotoneSegments(points).map(seg).join("");
}

/** Closed area path between a smooth top edge and the straight baseline `baseY`. */
export function smoothAreaPath(points: readonly Point[], baseY: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return "";
  return `${smoothLinePath(points)}L${f(last[0])} ${f(baseY)}L${f(first[0])} ${f(baseY)}Z`;
}

/** Closed band between two smooth edges (for stacked areas): `top` left-to-right, then `bottom` back. */
export function smoothBandPath(top: readonly Point[], bottom: readonly Point[]): string {
  const rev = [...bottom].reverse();
  const start = rev[0];
  if (!start || top.length === 0) return "";
  return `${smoothLinePath(top)}L${f(start[0])} ${f(start[1])}${monotoneSegments(rev).map(seg).join("")}Z`;
}

/** Evaluate a segment at t in [0,1] (used by tests and cursor snapping). */
export function bezierPoint(from: Point, s: BezierSegment, t: number): Point {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return [
    w[0] * from[0] + w[1] * s.c1[0] + w[2] * s.c2[0] + w[3] * s.to[0],
    w[0] * from[1] + w[1] * s.c1[1] + w[2] * s.c2[1] + w[3] * s.to[1],
  ];
}

/** Top-rounded rectangle path (bar charts); radius is clamped to half the width / the height. */
export function roundedTopRect(x: number, y: number, w: number, h: number, r: number): string {
  const rad = Math.max(0, Math.min(r, w / 2, h));
  return `M${f(x)} ${f(y + h)}V${f(y + rad)}Q${f(x)} ${f(y)} ${f(x + rad)} ${f(y)}H${f(x + w - rad)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + rad)}V${f(y + h)}Z`;
}
