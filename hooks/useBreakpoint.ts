import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { BREAKPOINTS, Breakpoint, GRID_COLUMNS } from '../constants/breakpoints';

/**
 * useBreakpoint
 * Single responsive source of truth for the whole app, backed by
 * useWindowDimensions (react-native-web on web).
 *
 * Returns the current named breakpoint plus convenience booleans so a single
 * layout file can switch between bottom tabs (mobile) and sidebar (web/tablet)
 * without mounting two separate navigation systems.
 */
export function useBreakpoint(): {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  gridColumns: number;
  width: number;
  height: number;
} {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const breakpoint: Breakpoint =
      width >= BREAKPOINTS.wide
        ? 'wide'
        : width >= BREAKPOINTS.desktop
          ? 'desktop'
          : width >= BREAKPOINTS.tablet
            ? 'tablet'
            : 'mobile';

    return {
      breakpoint,
      isMobile: breakpoint === 'mobile',
      isTablet: breakpoint === 'tablet',
      isDesktop: breakpoint === 'desktop' || breakpoint === 'wide',
      isWide: breakpoint === 'wide',
      gridColumns: GRID_COLUMNS[breakpoint],
      width,
      height,
    };
  }, [width, height]);
}
