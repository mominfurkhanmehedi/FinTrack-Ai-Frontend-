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

/** Max usable content width on desktop, centered for readability. */
export const MAX_CONTENT_WIDTH = 1200;

/** Grid column counts per breakpoint (Dashboard, Reports). */
export const GRID_COLUMNS: Record<Breakpoint, number> = {
  mobile: 1,
  tablet: 2,
  desktop: 3,
  wide: 4,
};
