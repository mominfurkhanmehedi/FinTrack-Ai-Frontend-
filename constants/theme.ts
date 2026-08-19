/**
 * Shared design tokens. Inline Tailwind classes cover most cases; this module
 * holds values that need to be referenced from JS (charts, navigation options)
 * and a few spacing/radius primitives used by non-NativeWind helpers.
 */
export const COLORS = {
  brand: '#4f46e5',
  brandDark: '#4338ca',
  success: '#22c55e',
  danger: '#ef4444',
  background: '#f9fafb',
  surface: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  textMuted: '#6b7280',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const FONT = {
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;
