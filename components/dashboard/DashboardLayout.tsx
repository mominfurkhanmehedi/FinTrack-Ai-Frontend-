import { Children, ReactElement, ReactNode } from 'react';
import { DimensionValue, View } from 'react-native';

import { useBreakpoint } from '../../hooks/useBreakpoint';

// Named tiers (window width in px). Matches constants/breakpoints LAYOUT.
// small & large mobile → 1 column, tablet → 2 columns, desktop+ → 4 columns.
const columnsFor = (width: number) => (width < 640 ? 1 : width < 1024 ? 2 : 4);
const gapFor = (width: number) => (width < 640 ? 12 : width < 1024 ? 16 : 20);

/**
 * DashboardPanel (dashboard)
 * Thin wrapper used ONLY to declare a column span for DashboardLayout
 * (span 1 = one grid cell, span 2 = half a 4-column desktop row). It renders
 * no markup itself — the layout reads the span from this element's props.
 */
export function DashboardPanel({ children }: { children: ReactNode; span?: number }) {
  return <>{children}</>;
}

/**
 * DashboardLayout (dashboard)
 * Purpose-built responsive grid for the Dashboard.
 *
 *   mobile  (< 640)   → 1 column: everything stacks full width
 *   tablet  (640–1023)→ 2 columns: summary cards pair up, wide cards span both
 *   desktop (≥ 1024)  → 4 columns: summary cards sit in one row, wide cards
 *                       share the next row evenly
 *
 * Fluid percentage widths + a shared gap mean there is no horizontal
 * scrolling, no device-specific sizing, and no wasted space at any width.
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const { width } = useBreakpoint();
  const cols = columnsFor(width);
  const gap = gapFor(width);

  // Keep children as elements so we can read each panel's `span` prop.
  const items = Children.toArray(children).filter(
    (child): child is ReactElement<{ span?: number }> =>
      typeof child === 'object' && child !== null && 'type' in child,
  );

  return (
    <View className="flex-row flex-wrap items-stretch" style={{ marginHorizontal: -gap / 2 }}>
      {items.map((item, i) => {
        const span = Math.min(Math.max(item.props?.span ?? 1, 1), cols);
        const itemWidth = `${(span / cols) * 100}%` as DimensionValue;
        return (
          <View
            key={i}
            className="flex"
            style={{ width: itemWidth, paddingHorizontal: gap / 2, marginBottom: gap }}
          >
            {item}
          </View>
        );
      })}
    </View>
  );
}