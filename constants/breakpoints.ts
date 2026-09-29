/**
 * Responsive breakpoints (px) shared across the app.
 * Used by hooks/useBreakpoint to switch navigation layout and grid columns.
 * Mobile-first: anything below `tablet` is treated as mobile.
 */
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

/** Named layout modes derived from window width. */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

/**
 * Max usable content width on desktop, centered for readability. Raised from
 * the original 1200 to 1440 so large screens don't leave big empty gutters
 * while text/columns still stay readable.
 */
export const MAX_CONTENT_WIDTH = 1440;

/** Grid column counts per breakpoint (Reports etc.). */
export const GRID_COLUMNS: Record<Breakpoint, number> = {
  mobile: 1,
  tablet: 2,
  desktop: 3,
  wide: 4,
};

/**
 * Finer content-layout tiers used by the Dashboard grid and the responsive
 * page container. These are pure window-width thresholds (px), so any screen
 * size resolves to a consistent, non-hardcoded layout:
 *
 *   small mobile  → < 480   (1 column, tighter padding)
 *   large mobile  → 480–639 (1 column)
 *   tablet        → 640–1023 (2 columns, wide cards stretch full width)
 *   desktop       → 1024–1279 (4-column summary, wide cards span half)
 *   large desktop → ≥ 1280 (most room)
 */
export const LAYOUT = {
  smallMobile: 480,
  largeMobile: 640,
  tablet: 1024,
  desktop: 1280,
} as const;

/**
 * The AI Insights grid tiers. Below `twoColumn` every panel is a single
 * full-width card (a phone), from `twoColumn` up panels pair up (a tablet in
 * portrait, where one 12-column-wide card would be absurdly wide), and from
 * `twelveColumn` the original 12-column desktop grid is used unchanged.
 */
export const INSIGHT_GRID = {
  twoColumn: 768,
  twelveColumn: 1024,
  gapSmall: 12,
  gapMedium: 16,
  gapLarge: 20,
} as const;

/** Horizontal page padding, mirroring `ResponsiveContainer`. */
export function pagePaddingX(width: number): number {
  return width < LAYOUT.largeMobile ? 16 : width < LAYOUT.tablet ? 24 : 32;
}

/** Number of grid columns the Insights layout uses at `width`. */
export function insightColumns(width: number): 1 | 2 | 12 {
  if (width >= INSIGHT_GRID.twelveColumn) return 12;
  return width >= INSIGHT_GRID.twoColumn ? 2 : 1;
}

/** Row/column gap the Insights layout uses at `width`. */
export function insightGap(width: number): number {
  return width < LAYOUT.smallMobile
    ? INSIGHT_GRID.gapSmall
    : width < INSIGHT_GRID.twelveColumn
      ? INSIGHT_GRID.gapMedium
      : INSIGHT_GRID.gapLarge;
}
