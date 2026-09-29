/**
 * Small SVG geometry helpers for the report charts.
 * Keep them pure and numeric so they are trivial to reason about and can never
 * put NaN/Infinity into an SVG attribute (which crashes SVG parsing).
 */

/** Always render a finite number into SVG attributes. */
export const str = (n: number): string => (Number.isFinite(n) ? String(n) : '0');

export type PathPoint = { x: number; y: number };

/**
 * Build an SVG path data string from coordinate points.
 *
 * Guarantees the output is ALWAYS valid: the initial "M" move-to command is
 * emitted exactly once, every point is a finite number, and the function
 * returns "" (so callers can skip rendering) unless there are at least two
 * valid points. This prevents "MM", "NaN", "undefined" or "Infinity" from
 * ever leaking into an SVG `d` attribute.
 */
export function buildPath(points: PathPoint[]): string {
  const parts: string[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    parts.push(`${parts.length === 0 ? 'M' : 'L'} ${p.x} ${p.y}`);
  }
  return parts.length >= 2 ? parts.join(' ') : '';
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Round a value up to a "nice" scale for the axis (1, 2, 2.5, 5, 10 × 10ⁿ) so
 * tick labels always stay round. Returns ≥ 1.
 */
export function niceMax(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(v));
  const frac = v / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * base;
}

/** Rounded-top bar path; keeps the bottom flush with the axis. */
export function roundedBarPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return (
    `M ${x} ${y + h} ` +
    `L ${x} ${y + rr} ` +
    `Q ${x} ${y} ${x + rr} ${y} ` +
    `L ${x + w - rr} ${y} ` +
    `Q ${x + w} ${y} ${x + w} ${y + rr} ` +
    `L ${x + w} ${y + h} Z`
  );
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Polar coordinate (cx, cy) at `radius` for the given angle (degrees, 0 = right). */
export function polar(cx: number, cy: number, radius: number, angleDeg: number): [number, number] {
  return [cx + radius * Math.cos(toRad(angleDeg)), cy + radius * Math.sin(toRad(angleDeg))];
}

/**
 * Donut (annulus) segment path between two angles at an outer & inner radius.
 * Segments start at -90° (top). Large-arc flag handles > 180° slices.
 */
export function donutSegment(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  sweepDeg: number,
): string {
  const endDeg = startDeg + sweepDeg;
  const [x0, y0] = polar(cx, cy, rOuter, startDeg);
  const [x1, y1] = polar(cx, cy, rOuter, endDeg);
  const [xi0, yi0] = polar(cx, cy, rInner, startDeg);
  const [xi1, yi1] = polar(cx, cy, rInner, endDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return (
    `M ${x0} ${y0} ` +
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1} ` +
    `L ${xi1} ${yi1} ` +
    `A ${rInner} ${rInner} 0 ${large} 0 ${xi0} ${yi0} ` +
    `Z`
  );
}